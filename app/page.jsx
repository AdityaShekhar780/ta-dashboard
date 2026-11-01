import { UNITS } from '../lib/units.js';

export default function Home() {
  return (
    <main className="home">
      <h1>Talent Acquisition dashboards</h1>
      <p>Choose a payroll unit.</p>
      <ul>
        {Object.values(UNITS).map((u) => (
          <li key={u.key}>
            <a href={`/${u.key}/`}>{u.name}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
