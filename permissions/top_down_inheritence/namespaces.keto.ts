import { Namespace, Context } from "@ory/keto-namespace-types";

class Organization implements Namespace {
  related: {
    members: User[];
  };

  permits = {
    member: (ctx: Context): boolean =>
      this.related.members.includes(ctx.subject),
  };
}

class User implements Namespace {}

class Role implements Namespace {
  related: {
    members: User[];
  };

  permits = {
    member: (ctx: Context): boolean =>
      this.related.members.includes(ctx.subject),
  };
}

class File implements Namespace {
  related: {
    viewers: Role[];
    parents: File[];
    organizations: Organization[];
  };

  permits = {
    view: (ctx: Context): boolean =>
      (this.related.organizations.traverse((org) => org.permits.member(ctx)) &&
        this.related.viewers.traverse((v) => v.permits.member(ctx))) ||
      this.related.parents.traverse((p) => p.permits.view(ctx)),
  };
}
