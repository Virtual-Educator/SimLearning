interface AdminPageProps {
  onSignOut: () => Promise<void>;
}

export function AdminPage({ onSignOut }: AdminPageProps) {
  return (
    <div className="page">
      <div className="card">
        <h1>Admin Dashboard</h1>
        <p>This area is reserved for admin users.</p>
        <button className="form__submit" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
