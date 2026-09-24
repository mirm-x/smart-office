export default function Home() {
  return (
    <main>
      <h1>Smart Office POC</h1>
      <p>
        Scaffold only -- the booking / check-in / release journey UI is the
        camp build. See <code>README.md</code> for run instructions and{" "}
        <code>AGENTS.md</code> for the Agentic SDLC this repo follows.
      </p>
      <ul>
        <li>
          <code>POST /api/auth/login</code> -- simulated sign-in (sets the session cookie)
        </li>
        <li>
          <code>POST /api/bookings</code> -- create a desk and/or parking booking
        </li>
        <li>
          <code>POST /api/bookings/:requestId/checkin</code> -- check in a booked resource
        </li>
        <li>
          <code>npm run worker</code> -- runs the automatic no-show release worker
        </li>
      </ul>
    </main>
  );
}
