package authz.approval

# Configure Keto URL (default to host.docker.internal so OPA in Docker can reach Keto)
keto_url := "http://host.docker.internal:4466"

# Main authorization decision
approval_or_not := {
	"allow": allowCombo,
	"obligations": obligations,
}

# Check if user is in ShareApprovers group
in_share_approvers_group if {
	input.user
	resp := http.send({
		"method": "GET",
		"url": sprintf("%s/relation-tuples?namespace=Group&relation=members&subject_set.namespace=User&subject_set.object=%s&subject_set.relation=", [keto_url, input.user]),
		"headers": {"Content-Type": "application/json"},
	})

	resp.status_code == 200
	some tuple in resp.body.relation_tuples
	tuple.object == "ShareApprovers"
}

# Get all members of ShareApprovers group
get_share_approvers := approvers if {
	resp := http.send({
		"method": "GET",
		"url": sprintf("%s/relation-tuples?namespace=Group&object=ShareApprovers&relation=members", [keto_url]),
		"headers": {"Content-Type": "application/json"},
	})

	resp.status_code == 200
	approvers := [tuple.subject_set.object | some tuple in resp.body.relation_tuples]
}

# Check specific permission with Keto
check_keto_permission(relation) := allowed if {
	input.user
	input.document
	resp := http.send({
		"method": "POST",
		"url": sprintf("%s/relation-tuples/check", [keto_url]),
		"body": {
			"namespace": "Document",
			"object": input.document,
			"relation": relation,
			"subject_set": {"namespace": "User", "object": input.user},
		},
		"headers": {"Content-Type": "application/json"},
	})

	resp.status_code == 200
	allowed := resp.body.allowed
}

# Check if user has share permission from Keto
has_share_permission if {
	check_keto_permission("share") == true
}

# Check if user has view permission from Keto
has_view_permission if {
	check_keto_permission("view") == true
}

# Check if user has edit permission from Keto
has_edit_permission if {
	check_keto_permission("edit") == true
}

# Check if user has any permission (view or edit, but not share)
has_other_permission if {
	has_view_permission
}

has_other_permission if {
	has_edit_permission
}

# Allow combo logic based on action
allowCombo if {
	input.relation == "share"
	in_share_approvers_group
}

allowCombo if {
	input.relation == "share"
	has_share_permission
}

allowCombo if {
	input.relation != "share"
	check_keto_permission(input.relation) == true
}

default allowCombo := false

# Collect obligations when access is denied
obligations := obligation

default obligations := set()

# Obligation: Need ShareApprovers approval (when trying to share but only has view/edit)
obligation contains {"type": "needs_share_approver_approval", "approvers": get_share_approvers} if {
	input.relation == "share"
	not in_share_approvers_group
	not has_share_permission
	has_other_permission
}

# Obligation: Security team notification (no permissions at all)
obligation contains {"type": "security_team_notification"} if {
	input.relation == "share"
	not in_share_approvers_group
	not has_share_permission
	not has_other_permission
}

# Obligation: Insufficient permissions for non-share actions
obligation contains {"type": "insufficient_permissions"} if {
	input.relation != "share"
	check_keto_permission(input.relation) != true
}
