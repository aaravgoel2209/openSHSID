import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '@heroui/react/avatar';
import { getAvatarUrl } from '../utils/avatar';
import client from '../api/client';

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client.get(`/auth/users/${userId}/`)
      .then((r) => setProfile(r.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!profile) {
    return <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">用户不存在。</div>;
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-gray-900 rounded-xl p-6 shadow-sm text-center">
        <Avatar size="lg" className="mx-auto mb-4">
          <AvatarImage src={getAvatarUrl(profile.username)} />
          <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-bold mb-2">{profile.username}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          加入时间：{profile.date_joined?.slice(0, 10)}
        </p>
        {profile.embedding && (
          <details className="mt-4 text-xs text-gray-400 dark:text-gray-400 cursor-pointer text-left">
            <summary className="inline">向量 ({profile.embedding.dim}维)</summary>
            <p className="mt-1 font-mono">[{profile.embedding.vector.join(', ')} ...]</p>
          </details>
        )}
      </div>
      <div className="mt-4 text-center">
        <Button variant="light" onPress={() => navigate(-1)}>返回</Button>
      </div>
    </div>
  );
}
