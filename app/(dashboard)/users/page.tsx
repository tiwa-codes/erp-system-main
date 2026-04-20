import UsersList from "./_components/users-list"

export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return (
    <UsersList
      excludeRole="provider"
      pageTitle="User Access Control"
      pageDescription="Manage users"
    />
  )
}
