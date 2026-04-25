import type { ReactNode } from 'react'
import { Header } from './Header'
import { BottomNav } from './BottomNav'

interface Props {
  children: ReactNode
  onMeshOpen?: () => void
}

export function Layout({ children, onMeshOpen }: Props) {
  return (
    <div className="flex flex-col h-screen bg-white">
      <Header onMeshOpen={onMeshOpen} />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
