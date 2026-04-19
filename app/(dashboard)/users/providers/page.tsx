import UsersList from "../_components/users-list"

export default function ProviderAccountsPage() {
  return (
    <UsersList
      defaultRole="provider"
      pageTitle="Provider Accounts"
      pageDescription="Manage provider users"
      hideRoleFilter
    />
  )
}
