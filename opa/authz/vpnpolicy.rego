package authz.vpn

# Configure Keto URL (default to host.docker.internal so OPA in Docker can reach Keto)
keto_url := "http://host.docker.internal:4466"

# Check if IP address is on the 10.x network
on_vpn_network if {
	input.client_ip
	startswith(input.client_ip, "10.")
}

# Main authorization decision
decision := {
	"allow": allow,
	"obligations": obligations,
}

# Check permissions with Keto
has_permission if {
	input.user
	input.document
	input.relation
	resp := http.send({
		"method": "POST",
		"url": sprintf("%s/relation-tuples/check", [keto_url]),
		"body": {
			"namespace": "Document",
			"object": input.document,
			"relation": input.relation,
			"subject_set": {"namespace": "User", "object": input.user},
		},
		"headers": {"Content-Type": "application/json"},
	})

	resp.status_code == 200
	resp.body.allowed == true
}

# Allow access if on VPN network and has permission
allow if {
	on_vpn_network
	has_permission
}

default allow := false

# Collect obligations when access is denied
obligations := obligation

default obligations := set()

# Obligation: Must connect to VPN if not on 10.x network
obligation contains "connect_to_vpn" if {
	not on_vpn_network
	input.client_ip
}

# Obligation: Need permission from Keto if not authorized
obligation contains "insufficient_permissions" if {
	on_vpn_network
	not has_permission
}
