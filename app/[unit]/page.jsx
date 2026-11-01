import { notFound } from 'next/navigation';
import Dashboard from '../../components/Dashboard.jsx';
import { UNITS } from '../../lib/units.js';

// Only /mu and /tetr are built. Any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(UNITS).map((unit) => ({ unit }));
}

export async function generateMetadata({ params }) {
  const { unit } = await params;
  const u = UNITS[unit];
  return { title: u ? `${u.short} · TA Dashboard` : 'TA Dashboard' };
}

export default async function UnitPage({ params }) {
  const { unit } = await params;
  const u = UNITS[unit];
  if (!u) notFound();
  return <Dashboard unitKey={u.key} unitName={u.name} />;
}
