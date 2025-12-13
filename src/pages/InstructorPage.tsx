interface InstructorPageProps {
  onSignOut: () => Promise<void>;
}

export function InstructorPage({ onSignOut }: InstructorPageProps) {
  return (
    <div className="page">
      <div className="card">
        <h1>Instructor Portal</h1>
        <p>Welcome! Instructor tools will be available here soon.</p>
        <button className="form__submit" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
