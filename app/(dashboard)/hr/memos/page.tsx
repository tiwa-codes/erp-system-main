"use client"

import { MemoPage } from "@/components/memos/MemoPage"

export const dynamic = 'force-dynamic'

export default function HRMemosPage() {
  return <MemoPage module="hr" title="HR Memos" />
}
