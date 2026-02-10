package authz.simple

default allowSimple := false

# Configure Keto URL (default to host.docker.internal so OPA in Docker can reach Keto)
keto_url := "http://host.docker.internal:4466"

allowSimple if {
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
            "subject_set": {"namespace": "User", "object": input.user}
        },
        "headers": {"Content-Type": "application/json"}
    })

    resp.status_code == 200
    resp.body.allowed == true
}
