import UsersList from "../_components/users-list"

export default function ProviderManagementPage() {
  return (
    <UsersList
      defaultRole="provider_manager"
      pageTitle="Provider's Management"
      pageDescription="Manage provider manager users"
      hideRoleFilter
    />
  )
}
