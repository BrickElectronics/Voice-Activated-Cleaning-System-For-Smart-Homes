"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Upload, Calculator, Map } from "lucide-react"

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <Map className="h-6 w-6 mr-2" />
            <span className="font-bold text-xl">GPS Mapper</span>
          </div>
          <div className="flex space-x-4">
            <NavLink href="/" active={pathname === "/"}>
              <Home size={18} className="mr-2" />
              Home
            </NavLink>
            <NavLink href="/upload" active={pathname === "/upload"}>
              <Upload size={18} className="mr-2" />
              Upload & Process
            </NavLink>
            <NavLink href="/algorithms" active={pathname === "/algorithms"}>
              <Calculator size={18} className="mr-2" />
              Algorithms
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  )
}

interface NavLinkProps {
  href: string
  active: boolean
  children: React.ReactNode
}

function NavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary-foreground text-primary"
          : "text-primary-foreground/90 hover:bg-primary-foreground/10 hover:text-primary-foreground"
      }`}
    >
      {children}
    </Link>
  )
}
