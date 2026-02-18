import { Namespace, Context } from "@ory/keto-namespace-types";

class User implements Namespace {}

class Role implements Namespace {
  related: {
    members: User[]
  }
}

// example tuples would be:
//   `Role:custom_1 file.view Organization:org1`
//   `Role:custom_1 file.edit Organization:org1`
// this would mean that members of the Role:custom_1 has "file.view" and "file.edit" permission on this Organization
class Organization implements Namespace {
  related: {
    admin: User[]

    "file.view": Role[]
    "file.edit": Role[]
    // other fine grained permissions 
  }

  permits = {
    canViewFile: (ctx: Context) => 
      this.permits.canEditFile(ctx) 
      || this.related["file.view"].traverse(r => r.related.members.includes(ctx.subject))
      || this.related.admin.includes(ctx.subject),

    canEditFile: (ctx: Context) => this.related["file.edit"].traverse(r => r.related.members.includes(ctx.subject)),
    canCreateNewFile: (ctx: Context) => this.permits.canEditFile(ctx),

    canUpdateRole: (ctx: Context) => this.related.admin.includes(ctx.subject)
  }
}

class File implements Namespace {
  related: {
    organization: Organization[]
  }

  permits = {
    view: (ctx: Context) => this.related.organization.traverse(o => o.permits.canViewFile(ctx)),
    edit: (ctx: Context) => this.related.organization.traverse(o => o.permits.canEditFile(ctx))
  }
}

// Org1 is created. add an admin user
// User:cto admin Organization:org1
// 
// add custom roles for this organization:
// 
// Role:scientist is allowed to do "file.view" on Organization:org1 
// relation-tuple create Role:scientist "file.view" Organization:org1
// 
// Role:researcher is allowed to do "file.edit" on Organization:org1
// relation-tuple create Role:researcher "file.edit" Organization:org1
// 
// A new user LabRat is created. assign him researcher role
// relation-tuple create User:LabRat member Role:researcher
// 
// A new user Wizard is created. assign him scientist
// relation-tuple create User:Wizard member Role:analyst
// 
// LabRat wants to create a new file:
// check User:Labrat canCreateNewFile Organization:org1
// 
// create the file
// relation-tuple create Organization:org1 organization File::data.txt
// 
// LabRat wants to edit a file:
// check User:Labrat edit File:data.txt // Allowed;
// 
// Wizard wants to edit a file:
// check User:Wizard edit File:data.txt // Denied; 