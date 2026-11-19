"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminUsers, createAdminUser, getStoredUser } from '../../../../utils/api';

export default function AdminUsersPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });

  const load = async () => {
    try {
      setUsers(await fetchAdminUsers());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    // The server enforces admin-only access; this just keeps agents off the page
    if (getStoredUser()?.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    setAllowed(true);
    load();
  }, [router]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await createAdminUser({ ...form, role: 'admin' });
      setSuccess(`Admin ${form.email} created.`);
      setForm({ fullName: '', email: '', password: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) return null;

  const input = "w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-blue-100";

  return (
    <div className="p-4 sm:p-8 max-w-5xl w-full mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Manage Users</h1>
      <p className="text-sm text-gray-500 mb-6">
        Only admins can add other admins. Agents sign up themselves and only see their own uploads; admins see everything.
      </p>

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-8 grid gap-4 sm:grid-cols-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Full name</label>
          <input className={input} required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
          <input className={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Password (min 8)</label>
          <input className={input} type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button disabled={saving} className="bg-[#0066FF] text-white font-bold rounded-lg py-2 px-4 hover:bg-[#0052cc] disabled:opacity-60">
          {saving ? 'Adding...' : 'Add admin'}
        </button>
      </form>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm border border-green-200">{success}</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Uploads</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-blue-100 text-[#0066FF]' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Agent'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.policy_count}</td>
                <td className="px-4 py-3 text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
