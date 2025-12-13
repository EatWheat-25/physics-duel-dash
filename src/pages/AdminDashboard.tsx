import AdminQuestions from './AdminQuestions';

/**
 * AdminDashboard acts as the entrypoint for the new admin panel.
 * It currently reuses the existing AdminQuestions experience so
 * navigation can point to a stable, dedicated route.
 */
export default function AdminDashboard() {
  return <AdminQuestions />;
}

