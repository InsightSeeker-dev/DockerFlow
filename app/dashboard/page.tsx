import { getServerSession } from 'next-auth';

export default async function DashboardUserHome() {
  const session = await getServerSession();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-blue-400">Bienvenue sur votre espace DockerFlow !</h1>
      <div className="bg-gray-900/80 rounded-xl p-6 flex flex-col gap-4 shadow-lg border border-gray-800">
        <p className="text-gray-200 text-lg">
          Bonjour <span className="font-semibold text-blue-300">{session?.user?.name || session?.user?.email}</span> 👋<br/>
          Retrouvez ici tous vos containers, images, volumes et paramètres personnels.
        </p>
        <div className="flex flex-wrap gap-4 mt-4">
          <a href="/dashboard/containers" className="px-6 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition">Mes containers</a>
          <a href="/dashboard/images" className="px-6 py-3 bg-blue-500 rounded-lg text-white font-medium hover:bg-blue-600 transition">Mes images</a>
          <a href="/dashboard/profile" className="px-6 py-3 bg-gray-700 rounded-lg text-gray-100 font-medium hover:bg-gray-600 transition">Mon profil</a>
          <a href="/dashboard/settings" className="px-6 py-3 bg-gray-700 rounded-lg text-gray-100 font-medium hover:bg-gray-600 transition">Paramètres</a>
        </div>
      </div>
    </div>
  );
}
