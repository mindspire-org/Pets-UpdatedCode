import React from 'react'
import PortalCard from '../components/PortalCard'
import { MdAdminPanelSettings, MdLocalPharmacy } from 'react-icons/md'
import { FiClipboard } from 'react-icons/fi'
import { TbMicroscope } from 'react-icons/tb'
import { FaPaw, FaStethoscope } from 'react-icons/fa'

export default function Home() {
  const portals = [
    {
      name: 'Main Admin',
      icon: <MdAdminPanelSettings />,
      description: 'Users, roles, reports, and overall system management.',
      to: '/admin/login',
      bg: 'bg-indigo-50',
      accentColor: 'bg-indigo-500',
    },
    {
      name: 'Reception',
      icon: <FiClipboard />,
      description: 'Appointments, patients check-in, and billing initiation.',
      to: '/reception/login',
      bg: 'bg-emerald-50',
      accentColor: 'bg-emerald-500',
    },
    {
      name: 'Pharmacy',
      icon: <MdLocalPharmacy />,
      description: 'Prescriptions, inventory, and POS for medicines.',
      to: '/pharmacy/login',
      bg: 'bg-sky-50',
      accentColor: 'bg-sky-500',
    },
    {
      name: 'Laboratory',
      icon: <TbMicroscope />,
      description: 'Lab orders, tests, and results management.',
      to: '/lab/login',
      bg: 'bg-teal-50',
      accentColor: 'bg-teal-500',
    },
    {
      name: 'Doctor',
      icon: <FaStethoscope />,
      description: 'Doctors portal: patient visits, notes, and review.',
      to: '/doctor/login',
      bg: 'bg-emerald-50',
      accentColor: 'bg-emerald-500',
    },
    {
      name: 'Pets Shop',
      icon: <FaPaw />,
      description: 'Pet items catalog, inventory and retail sales.',
      to: '/shop/login',
      bg: 'bg-amber-50',
      accentColor: 'bg-amber-500',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-hospital-blue">
      <header className="py-14">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center text-slate-800 tracking-tight">Abbottabad Pet Hospital</h1>
        <p className="text-center text-slate-600 mt-3 text-base md:text-lg">Select a module to start</p>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-8">
          {portals.map(p => (
            <PortalCard
              key={p.name}
              name={p.name}
              icon={p.icon}
              description={p.description}
              to={p.to}
              bg={p.bg}
              accentColor={p.accentColor}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
