/** Keep Unicode initials, including names with spaces, apostrophes and hyphens. */
export function robotInitials(name: string) {
  return (name.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? ['Art', 'Bot'])
    .map(word => Array.from(word)[0]!).join('').toLocaleUpperCase();
}
