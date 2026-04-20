export const dynamic = 'force-dynamic'

import UsersList from "../_components/users-list"



export default function ClientAccountsPage() {
  return (
    <UsersList
      defaultRole="guest_or_client"
      pageTitle="Client Accounts"
      pageDescription="Manage client portal user accounts"
      hideRoleFilter
    />
  )
}

