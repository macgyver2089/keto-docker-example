// Ory Keto Permission Model - Document/File Sharing Example
// This models a Google Drive-like permission system

import { Context, Namespace, SubjectSet } from "@ory/keto-namespace-types"

// Users are the subjects in our permission system
class User implements Namespace {
  related: {
    // Users can have managers (for organizational hierarchy)
    manager: User[]
  }
}

// Groups allow grouping users together for easier permission management
class Group implements Namespace {
  related: {
    members: User[]
    subGroups: Group[]
  }

  permits = {
    // A subject is a member if they are directly in the group or in a nested group
    isMember: (ctx: Context): boolean =>
      this.related.members.includes(ctx.subject) ||
      this.related.subGroups.traverse((g) => g.permits.isMember(ctx)),
  }
}

// Folders can contain files and other folders
class Folder implements Namespace {
  related: {
    // Parent folder (for inheritance)
    parents: Folder[]
    // Direct viewers of this folder (Groups can view directly)
    viewers: User[]
    viewerGroups: Group[]
    // Direct editors of this folder (Groups can edit directly)
    editors: User[]
    editorGroups: Group[]
    // Owners have full control (Groups can own directly)
    owners: User[]
    ownerGroups: Group[]
  }

  permits = {
    // Can view if: direct viewer, editor, owner, or inherits from parent
    view: (ctx: Context): boolean =>
      this.related.viewers.includes(ctx.subject) ||
      this.related.viewerGroups.traverse((g) => g.permits.isMember(ctx)) ||
      this.related.editors.includes(ctx.subject) ||
      this.related.editorGroups.traverse((g) => g.permits.isMember(ctx)) ||
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)) ||

      this.related.parents.traverse((p) => p.permits.view(ctx)),

    // Can edit if: direct editor, owner, or inherits from parent
    edit: (ctx: Context): boolean =>
      this.related.editors.includes(ctx.subject) ||
      this.related.editorGroups.traverse((g) => g.permits.isMember(ctx)) ||
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)) ||

      this.related.parents.traverse((p) => p.permits.edit(ctx)),

    // Can delete/manage if: owner or inherits from parent
    delete: (ctx: Context): boolean =>
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)) ||

      this.related.parents.traverse((p) => p.permits.delete(ctx)),

    // Can share if owner
    share: (ctx: Context): boolean =>
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)),
  }
}

// Documents/Files that can be shared
class Document implements Namespace {
  related: {
    // Parent folder (for inheritance)
    parents: Folder[]
    // Direct viewers of this folder (Groups can view directly)
    viewers: User[]
    viewerGroups: Group[]
    // Direct editors of this folder (Groups can edit directly)
    editors: User[]
    editorGroups: Group[]
    // Owners have full control (Groups can own directly)
    owners: User[]
    ownerGroups: Group[]
  }

  permits = {
    // Can view if: direct viewer, editor, owner, or inherits from parent folder
    view: (ctx: Context): boolean =>
      this.related.viewers.includes(ctx.subject) ||
      this.related.viewerGroups.traverse((g) => g.permits.isMember(ctx)) ||
      this.related.editors.includes(ctx.subject) ||
      this.related.editorGroups.traverse((g) => g.permits.isMember(ctx)) ||
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)) ||

      this.related.parents.traverse((p) => p.permits.view(ctx)),

    // Can edit if: direct editor, owner, or inherits from parent folder
    edit: (ctx: Context): boolean =>
      this.related.editors.includes(ctx.subject) ||
      this.related.editorGroups.traverse((g) => g.permits.isMember(ctx)) ||
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)) ||

      this.related.parents.traverse((p) => p.permits.edit(ctx)),

    // Can delete if owner or inherits from parent folder
    delete: (ctx: Context): boolean =>
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)) ||

      this.related.parents.traverse((p) => p.permits.delete(ctx)),

    // Can share if owner
    share: (ctx: Context): boolean =>
      this.related.owners.includes(ctx.subject) ||
      this.related.ownerGroups.traverse((g) => g.permits.isMember(ctx)),
  }
}
