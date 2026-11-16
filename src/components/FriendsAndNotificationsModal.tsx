import React, { useEffect, useState } from 'react';
import {
  AtSign,
  Bell,
  Check,
  CheckCheck,
  LogIn,
  Send,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { AppNotification } from '../types/jamr';
import { CharacterAvatar } from './CharacterAvatar';
import { SoundFX } from '../utils/soundFx';
import { getOrCreateSessionPlayerId } from '../network/socketClient';

export interface FriendSummary {
  username: string;
  displayName: string;
  avatar: string;
  avatarBg?: string;
  isOnline: boolean;
  roomCode: string | null;
  gameId: string | null;
  gameTitle?: string;
}

interface FriendsAndNotificationsModalProps {
  initialTab?: 'friends' | 'notifications';
  username: string;
  displayName: string;
  avatar: string;
  avatarBg: string;
  activeRoomCode?: string | null;
  notifications: AppNotification[];
  onUsernameSaved: (username: string) => void;
  onNotificationsChange: (notifications: AppNotification[]) => void;
  onJoinRoomDirect: (roomCode: string) => void;
  onClose: () => void;
}

export const FriendsAndNotificationsModal: React.FC<FriendsAndNotificationsModalProps> = ({
  initialTab = 'friends',
  username,
  displayName,
  avatar,
  avatarBg,
  activeRoomCode,
  notifications,
  onUsernameSaved,
  onNotificationsChange,
  onJoinRoomDirect,
  onClose,
}) => {
  const [tab, setTab] = useState<'friends' | 'notifications'>(initialTab);
  const [notifFilter, setNotifFilter] = useState<'all' | 'friend_request' | 'room_invite' | 'room_chat'>('all');

  const [handleInput, setHandleInput] = useState(username || '');
  const [registering, setRegistering] = useState(false);
  const [handleError, setHandleError] = useState('');
  const [handleSuccess, setHandleSuccess] = useState('');

  const [searchUsername, setSearchUsername] = useState('');
  const [friendMsg, setFriendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [incoming, setIncoming] = useState<FriendSummary[]>([]);
  const [outgoing, setOutgoing] = useState<FriendSummary[]>([]);
  const [registered, setRegistered] = useState(Boolean(username));

  const fetchFriendsState = async (targetUser: string) => {
    if (!targetUser) return;
    try {
      const res = await fetch(`/api/friends/state?username=${encodeURIComponent(targetUser)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok) {
        setRegistered(Boolean(data.registered));
        setFriends(Array.isArray(data.friends) ? data.friends : []);
        setIncoming(Array.isArray(data.incomingRequests) ? data.incomingRequests : []);
        setOutgoing(Array.isArray(data.outgoingRequests) ? data.outgoingRequests : []);
        if (Array.isArray(data.notifications)) {
          onNotificationsChange(data.notifications);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (username) {
      void fetchFriendsState(username);
    }
  }, [username]);

  const handleRegisterUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = handleInput.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleaned)) {
      setHandleError('اكتب يوزر نيم باللغة الإنجليزية (أحرف/أرقام/شرطة سفلية فقط، 3–20 خانة).');
      return;
    }
    setRegistering(true);
    setHandleError('');
    setHandleSuccess('');
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleaned,
          playerId: getOrCreateSessionPlayerId(),
          displayName: displayName || 'لاعب جَمْر',
          avatar,
          avatarBg,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        SoundFX.playWrong();
        setHandleError(String(json?.error || 'تعذر حجز اليوزر نيم.'));
        return;
      }
      SoundFX.playCorrect();
      onUsernameSaved(cleaned);
      setRegistered(true);
      setHandleSuccess(`تم توثيق اليوزر نيم الفريد الخاص بك: @${cleaned} 🎉`);
      void fetchFriendsState(cleaned);
    } catch {
      setHandleError('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setRegistering(false);
    }
  };

  const sendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !registered) {
      setFriendMsg({ ok: false, text: 'يجب إنشاء يوزر نيم فريد خاص بك أولاً قبل إضافة الأصدقاء!' });
      return;
    }
    const target = searchUsername.trim().replace(/^@+/, '').toLowerCase();
    if (!target) {
      setFriendMsg({ ok: false, text: 'اكتب اليوزر نيم الدقيق للشخص الذي تريد إضافته.' });
      return;
    }
    setLoadingAction(true);
    setFriendMsg(null);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUsername: username, targetUsername: target }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        SoundFX.playWrong();
        setFriendMsg({ ok: false, text: String(json?.error || 'تعذر إرسال الطلب') });
      } else {
        SoundFX.playCorrect();
        setSearchUsername('');
        setFriendMsg({ ok: true, text: String(json.message) });
        void fetchFriendsState(username);
      }
    } catch {
      setFriendMsg({ ok: false, text: 'خطأ في الاتصال بالخادم.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const respondRequest = async (fromUser: string, accept: boolean) => {
    if (!username || !registered) {
      setFriendMsg({ ok: false, text: 'أنشئ يوزر نيم خاص بك أولاً لقبول الطلبات!' });
      return;
    }
    await fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, fromUsername: fromUser, accept }),
    });
    SoundFX.playClick();
    void fetchFriendsState(username);
  };

  const inviteFriendToRoom = async (targetUser: string) => {
    if (!activeRoomCode) {
      setFriendMsg({ ok: false, text: 'افتح أو انضم لغرفة أونلاين أولاً لتتمكن من دعوة أصدقائك!' });
      return;
    }
    const res = await fetch('/api/friends/invite-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromUsername: username,
        targetUsername: targetUser,
        roomCode: activeRoomCode,
      }),
    });
    const json = await res.json();
    if (res.ok && json?.ok) {
      SoundFX.playCorrect();
      setFriendMsg({ ok: true, text: String(json.message) });
    } else {
      setFriendMsg({ ok: false, text: String(json?.error || 'تعذر إرسال الدعوة') });
    }
  };

  const markAllRead = async () => {
    if (!username) return;
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    onNotificationsChange(notifications.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = notifications.filter((n) =>
    notifFilter === 'all' ? true : n.type === notifFilter
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#23140E]/55 backdrop-blur-md p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2.5">
            {tab === 'friends' ? (
              <Users className="w-5 h-5 text-orange-500" />
            ) : (
              <Bell className="w-5 h-5 text-orange-500" />
            )}
            <h2 className="text-lg font-black text-[#23140E]">
              {tab === 'friends' ? 'الأصدقاء واليوزر نيم الفريد' : 'مركز الإشعارات'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-[#FFFDF9] border-b border-amber-100">
          <button
            type="button"
            onClick={() => setTab('friends')}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'friends'
                ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-sm'
                : 'bg-[#FFF8EE] text-[#5A3E32] border border-amber-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>الأصدقاء ({friends.length})</span>
            {incoming.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px]">
                {incoming.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'notifications'
                ? 'bg-gradient-to-l from-teal-500 to-emerald-500 text-white shadow-sm'
                : 'bg-[#FFF8EE] text-[#5A3E32] border border-amber-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>الإشعارات</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px]">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Mandatory Unique Username Card */}
          <div className="rounded-2xl bg-[#FFF8EE] border-2 border-amber-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black text-orange-800">
                <AtSign className="w-4 h-4 text-orange-500" />
                <span>
                  {registered && username
                    ? `يوزر نيمك الموثّق: @${username}`
                    : 'شرط أساسي: أنشئ يوزر نيم غير مكرر لإضافة الأصدقاء'}
                </span>
              </div>
              {registered && (
                <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  موثّق وفريد ✅
                </span>
              )}
            </div>

            {!registered && (
              <form onSubmit={handleRegisterUsername} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-black text-orange-500">
                    @
                  </span>
                  <input
                    type="text"
                    value={handleInput}
                    onChange={(e) => {
                      setHandleInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
                      setHandleError('');
                    }}
                    placeholder="مثال: abu_fahad99"
                    dir="ltr"
                    className="w-full rounded-xl bg-white border border-amber-200 pr-8 pl-3 py-2 text-sm font-mono font-bold text-[#23140E]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black text-xs cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {registering ? 'جاري التحقق...' : 'حجز وتفعيل اليوزر نيم'}
                </button>
              </form>
            )}
            {handleError && <p className="text-xs font-bold text-rose-700">{handleError}</p>}
            {handleSuccess && <p className="text-xs font-bold text-emerald-700">{handleSuccess}</p>}
          </div>

          {tab === 'friends' ? (
            <>
              {/* Add Friend strictly by @username */}
              <form
                onSubmit={sendFriendRequest}
                className={`rounded-2xl bg-white border border-amber-200 p-4 space-y-2.5 ${
                  !registered ? 'opacity-60' : ''
                }`}
              >
                <label className="block text-xs font-black text-[#23140E]">
                  إضافة صديق (بالبحث عن اليوزر نيم الفريد فقط):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-black text-teal-600">
                      @
                    </span>
                    <input
                      type="text"
                      disabled={!registered}
                      value={searchUsername}
                      onChange={(e) =>
                        setSearchUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
                      }
                      placeholder={
                        registered ? 'أدخل يوزر نيم الصديق...' : 'أنشئ يوزر نيمك أولاً أعلاه'
                      }
                      dir="ltr"
                      className="w-full rounded-xl bg-[#FFF8EE] border border-amber-200 pr-8 pl-3 py-2 text-sm font-mono font-bold text-[#23140E]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingAction || !registered}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إرسال طلب صداقة</span>
                  </button>
                </div>
                {friendMsg && (
                  <p
                    className={`text-xs font-bold ${
                      friendMsg.ok ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {friendMsg.text}
                  </p>
                )}
              </form>

              {/* Incoming Requests */}
              {incoming.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-orange-700">
                    طلبات صداقة واردة ({incoming.length})
                  </h3>
                  <div className="space-y-2">
                    {incoming.map((reqUser) => (
                      <div
                        key={reqUser.username}
                        className="rounded-2xl bg-amber-50 border border-amber-300 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CharacterAvatar
                            avatarId={reqUser.avatar}
                            backgroundColor={reqUser.avatarBg}
                            size={36}
                            interactive={false}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-black text-[#23140E] truncate">
                              {reqUser.displayName}
                            </div>
                            <div className="text-[11px] font-mono text-orange-700">
                              @{reqUser.username}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void respondRequest(reqUser.username, true)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>قبول</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void respondRequest(reqUser.username, false)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-100 text-rose-700 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>رفض</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outgoing Requests */}
              {outgoing.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7C5D4F]">
                  <span className="font-bold">طلبات مرسلة بانتظار الموافقة:</span>
                  {outgoing.map((o) => (
                    <span
                      key={o.username}
                      className="px-2.5 py-1 rounded-full bg-[#FFF8EE] border border-amber-200 font-mono"
                    >
                      @{o.username}
                    </span>
                  ))}
                </div>
              )}

              {/* Friends List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-[#5A3E32]">
                  قائمة أصدقائك ({friends.length})
                </h3>
                {friends.length === 0 ? (
                  <div className="rounded-2xl bg-[#FFFDF9] border border-amber-100 p-8 text-center text-xs text-[#7C5D4F]">
                    لا يوجد أصدقاء مضافون بعد. شارك يوزر نيمك مع ربعك أو أضفهم فوق!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {friends.map((fr) => (
                      <div
                        key={fr.username}
                        className="rounded-2xl bg-white border border-amber-200 p-3.5 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative">
                              <CharacterAvatar
                                avatarId={fr.avatar}
                                backgroundColor={fr.avatarBg}
                                size={40}
                                interactive={false}
                              />
                              <span
                                className={`w-3 h-3 rounded-full border-2 border-white absolute -bottom-0.5 -right-0.5 ${
                                  fr.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black text-[#23140E] truncate">
                                {fr.displayName}
                              </div>
                              <div className="text-[11px] font-mono text-orange-700 truncate">
                                @{fr.username}
                              </div>
                            </div>
                          </div>
                          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        </div>

                        <div className="text-[11px] font-bold text-[#6B4E40]">
                          {fr.roomCode
                            ? `يلعب الآن: ${fr.gameTitle || 'غرفة'} (${fr.roomCode})`
                            : fr.isOnline
                              ? 'متصل الآن في المنصة 🟢'
                              : 'غير متصل حالياً'}
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {fr.roomCode && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onJoinRoomDirect(fr.roomCode!);
                              }}
                              className="flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-l from-teal-500 to-emerald-500 text-white text-[11px] font-black inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>انضمام مباشر لغرفته</span>
                            </button>
                          )}
                          {activeRoomCode && (
                            <button
                              type="button"
                              onClick={() => void inviteFriendToRoom(fr.username)}
                              className="flex-1 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-orange-900 border border-amber-300 text-[11px] font-black inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>دعوة لغرفتي</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Notifications Center */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'friend_request', label: 'دعوات الصداقة' },
                    { id: 'room_invite', label: 'دعوات الغرف' },
                    { id: 'room_chat', label: 'شات الغرفة' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setNotifFilter(f.id as typeof notifFilter)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                        notifFilter === f.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-[#FFF8EE] text-[#5A3E32] border border-amber-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="text-xs font-black text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>تحديد الكل كمقروء</span>
                  </button>
                )}
              </div>

              {filteredNotifications.length === 0 ? (
                <div className="rounded-2xl bg-[#FFFDF9] border border-amber-100 p-10 text-center text-xs text-[#7C5D4F]">
                  لا توجد إشعارات في هذا القسم حالياً.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-2xl border p-3.5 flex items-start justify-between gap-3 ${
                        n.read
                          ? 'bg-white border-amber-100'
                          : 'bg-amber-50/90 border-orange-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <CharacterAvatar
                          avatarId={n.fromAvatar || 'char_01'}
                          backgroundColor={n.fromAvatarBg}
                          size={36}
                          interactive={false}
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-xs font-black text-[#23140E]">{n.title}</div>
                          <div className="text-xs text-[#5A3E32] leading-relaxed">{n.body}</div>
                          <div className="text-[10px] text-[#9A7B6D]">
                            {new Date(n.createdAt).toLocaleTimeString('ar-SA', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>

                      {n.type === 'room_invite' && n.roomCode && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onJoinRoomDirect(n.roomCode!);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white text-xs font-black shrink-0 cursor-pointer"
                        >
                          دخول الغرفة
                        </button>
                      )}

                      {n.type === 'friend_request' &&
                        n.fromUsername &&
                        incoming.some((i) => i.username === n.fromUsername) && (
                          <button
                            type="button"
                            onClick={() => void respondRequest(n.fromUsername!, true)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black shrink-0 cursor-pointer"
                          >
                            قبول
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
