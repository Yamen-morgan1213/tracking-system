import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Copy, 
  Check, 
  Edit2, 
  Trash2, 
  Users, 
  Activity, 
  Key, 
  Search, 
  X, 
  Award,
  Flame,
  UserPlus,
  Lock,
  LogOut
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_auth') === 'true'
  })
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)

  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Edit Modal State
  const [editPlayer, setEditPlayer] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSessionsCount, setEditSessionsCount] = useState(0)
  const [updating, setUpdating] = useState(false)

  // Delete Modal State
  const [deletePlayer, setDeletePlayer] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handlePinSubmit = (e) => {
    e.preventDefault()
    if (pin === '23001') {
      sessionStorage.setItem('admin_auth', 'true')
      setIsAdminAuthenticated(true)
      toast.success('Access Granted. Welcome Coach.')
    } else {
      setPinError(true)
      toast.error('Access Denied. Invalid PIN.')
      setPin('')
      setTimeout(() => setPinError(false), 500)
    }
  }

  useEffect(() => {
    if (!isAdminAuthenticated) return

    fetchPlayers()

    // Supabase Real-time Subscription
    const channel = supabase
      .channel('admin-players-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => {
              if (prev.some((p) => p.id === payload.new.id)) return prev
              return [...prev, payload.new].sort((a, b) => a.name.localeCompare(b.name))
            })
          } else if (payload.eventType === 'UPDATE') {
            setPlayers((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAdminAuthenticated])

  const fetchPlayers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error fetching players:', error)
      toast.error('Failed to load players dashboard')
    } finally {
      setLoading(false)
    }
  }

  const generatePasscode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let result = ''
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const handleAddPlayer = async (e) => {
    e.preventDefault()
    if (!newPlayerName.trim()) return

    setSubmitting(true)
    const passcode = generatePasscode()

    try {
      const { data, error } = await supabase
        .from('players')
        .insert([
          {
            name: newPlayerName.trim(),
            passcode,
            sessions_count: 0,
            last_login: null
          }
        ])
        .select()

      if (error) {
        if (error.code === '23505') {
          // Passcode uniqueness collision, retry once
          const retryPasscode = generatePasscode()
          const { data: retryData, error: retryError } = await supabase
            .from('players')
            .insert([
              {
                name: newPlayerName.trim(),
                passcode: retryPasscode,
                sessions_count: 0,
                last_login: null
              }
            ])
            .select()
          if (retryError) throw retryError
          if (retryData && retryData[0]) {
            setPlayers((prev) => {
              if (prev.some((p) => p.id === retryData[0].id)) return prev
              return [...prev, retryData[0]].sort((a, b) => a.name.localeCompare(b.name))
            })
          }
        } else {
          throw error
        }
      } else if (data && data[0]) {
        setPlayers((prev) => {
          if (prev.some((p) => p.id === data[0].id)) return prev
          return [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name))
        })
      }

      toast.success(`Player "${newPlayerName.trim()}" added! Passcode: ${passcode}`, {
        duration: 8000
      })
      setNewPlayerName('')
    } catch (error) {
      console.error('Error adding player:', error)
      toast.error('Failed to add player')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyPasscode = (id, passcode) => {
    navigator.clipboard.writeText(passcode)
    setCopiedId(id)
    toast.success('Passcode copied to clipboard!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openEditModal = (player) => {
    setEditPlayer(player)
    setEditName(player.name)
    setEditSessionsCount(player.sessions_count)
  }

  const handleUpdatePlayer = async (e) => {
    e.preventDefault()
    if (!editPlayer || !editName.trim()) return

    setUpdating(true)
    try {
      const updatedFields = {
        name: editName.trim(),
        sessions_count: Math.max(0, parseInt(editSessionsCount) || 0)
      }
      const { error } = await supabase
        .from('players')
        .update(updatedFields)
        .eq('id', editPlayer.id)

      if (error) throw error
      
      setPlayers((prev) =>
        prev.map((p) => (p.id === editPlayer.id ? { ...p, ...updatedFields } : p))
      )
      
      toast.success('Player updated successfully')
      setEditPlayer(null)
    } catch (error) {
      console.error('Error updating player:', error)
      toast.error('Failed to update player')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeletePlayer = async () => {
    if (!deletePlayer) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', deletePlayer.id)

      if (error) throw error
      
      setPlayers((prev) => prev.filter((p) => p.id !== deletePlayer.id))
      
      toast.success('Player deleted successfully')
      setDeletePlayer(null)
    } catch (error) {
      console.error('Error deleting player:', error)
      toast.error('Failed to delete player')
    } finally {
      setDeleting(false)
    }
  }

  const isRecentLogin = (lastLoginString) => {
    if (!lastLoginString) return false
    const lastLogin = new Date(lastLoginString)
    const now = new Date()
    const diffInMs = now - lastLogin
    const diffInHours = diffInMs / (1000 * 60 * 60)
    return diffInHours >= 0 && diffInHours < 12
  }

  const formatLastLogin = (lastLoginString) => {
    if (!lastLoginString) return 'Never logged in'
    const date = new Date(lastLoginString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    
    if (diffInSeconds < 0) return 'Just now'
    if (diffInSeconds < 60) return 'Just now'
    
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) return 'Yesterday'
    return `${diffInDays}d ago`
  }

  // Filter players based on search query
  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.passcode.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculations for dashboard stats
  const totalPlayers = players.length
  const activeToday = players.filter((p) => isRecentLogin(p.last_login)).length
  const totalSessionsRecorded = players.reduce((sum, p) => sum + p.sessions_count, 0)

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            x: pinError ? [0, -10, 10, -10, 10, 0] : 0
          }}
          transition={{ duration: 0.4 }}
          className="glass-panel w-full max-w-sm rounded-3xl p-8 border border-white/5 shadow-2xl text-center relative z-10"
        >
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock size={28} />
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">Coach Access Control</h2>
          <p className="text-xs text-gray-400 mt-2 mb-8">
            Please enter your security PIN to access the command center.
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="password"
                pattern="[0-9]*"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="•••••"
                maxLength={5}
                className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 rounded-2xl glass-input border border-white/10 placeholder-gray-700 focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-2xl shadow-lg transition duration-200 uppercase tracking-wider text-xs"
            >
              Verify PIN & Unlock
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
            Muhammad El-Sayed
          </h1>
          <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Attendance Command Center • Live Monitoring Active
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/player"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs font-semibold tracking-wide uppercase bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition duration-200"
          >
            Launch Player Portal ↗
          </a>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              setIsAdminAuthenticated(false)
              toast.success('Logged out successfully.')
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold tracking-wide uppercase bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition duration-200 cursor-pointer"
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </div>

      {/* Stats Counter Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel rounded-2xl p-6 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Athletes</p>
            <h3 className="text-2xl font-bold mt-1 text-white">{totalPlayers}</h3>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active Today (12h)</p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-400 flex items-center gap-2">
              {activeToday}
              {activeToday > 0 && (
                <span className="text-xs font-normal text-gray-400">({Math.round((activeToday / (totalPlayers || 1)) * 100)}%)</span>
              )}
            </h3>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Accumulated Sessions</p>
            <h3 className="text-2xl font-bold mt-1 text-white">{totalSessionsRecorded}</h3>
          </div>
        </div>
      </div>

      {/* Actions and Search Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start">
        {/* Form to Add Player */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-1 border border-white/5">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <UserPlus className="text-emerald-400" size={20} />
            Register New Athlete
          </h2>
          <form onSubmit={handleAddPlayer} className="space-y-4">
            <div>
              <label htmlFor="playerName" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Athlete Name
              </label>
              <input
                id="playerName"
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter player full name..."
                required
                className="w-full px-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !newPlayerName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {submitting ? 'Generating Code...' : 'Add Player & Generate Passcode'}
              {!submitting && <Plus size={18} />}
            </button>
          </form>
        </div>

        {/* Search Bar / Filters */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 flex flex-col justify-between h-full min-h-[162px] border border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Search Roster</h2>
            <p className="text-xs text-gray-400 mb-4">Filter registered players by name or specific 5-character passcode.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or passcode..."
              className="w-full pl-12 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Roster Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Athletes Roster
            <span className="text-xs font-normal text-gray-400 px-2 py-0.5 bg-white/5 rounded-full">
              {filteredPlayers.length} of {totalPlayers}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-gray-400 text-sm mt-4">Streaming database records...</p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border border-white/5">
            <p className="text-gray-400">No athletes found matching the search criteria.</p>
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredPlayers.map((player) => {
                const active = isRecentLogin(player.last_login)
                const completionPercentage = Math.min((player.sessions_count / 30) * 100, 100)
                const reachedGoal = player.sessions_count >= 30

                return (
                  <motion.div
                    key={player.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    className={`glass-card rounded-2xl p-6 relative flex flex-col justify-between ${
                      active 
                        ? 'ring-1 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.15)] bg-emerald-950/5' 
                        : ''
                    }`}
                  >
                    {/* Glowing Aura for active athletes */}
                    {active && (
                      <span className="absolute top-4 right-4 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                      </span>
                    )}

                    {/* Card Content */}
                    <div>
                      {/* Name and Trophy */}
                      <div className="flex justify-between items-start pr-6">
                        <h3 className="font-bold text-lg text-white tracking-tight break-all line-clamp-1">
                          {player.name}
                        </h3>
                        {reachedGoal && (
                          <div className="text-yellow-400 flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-full text-xs font-semibold border border-yellow-500/20">
                            <Award size={12} />
                            Milestone
                          </div>
                        )}
                      </div>

                      {/* Passcode Copy area */}
                      <div className="flex items-center gap-2 mt-2 bg-black/30 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                        <Key size={13} className="text-gray-500" />
                        <span className="text-xs font-mono tracking-widest text-emerald-400 font-bold uppercase">
                          {player.passcode}
                        </span>
                        <button
                          onClick={() => handleCopyPasscode(player.id, player.passcode)}
                          className="text-gray-400 hover:text-emerald-400 transition ml-1 cursor-pointer"
                          title="Copy Passcode"
                        >
                          {copiedId === player.id ? (
                            <Check size={13} className="text-emerald-400 animate-scale" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>

                      {/* Sessions Status */}
                      <div className="mt-6">
                        <div className="flex justify-between text-xs font-medium mb-1.5">
                          <span className="text-gray-400 flex items-center gap-1">
                            Sessions Completed
                            {player.sessions_count > 0 && (
                              <Flame size={12} className="text-orange-500 animate-pulse" />
                            )}
                          </span>
                          <span className={`${reachedGoal ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                            {player.sessions_count} / 30
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              reachedGoal
                                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]'
                                : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                            }`}
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                      <div className="text-gray-500">
                        <span className="block text-[10px] uppercase tracking-wider text-gray-500">Last Session</span>
                        <span className={`font-medium ${active ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {formatLastLogin(player.last_login)}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(player)}
                          className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition"
                          title="Edit Athlete Profile"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletePlayer(player)}
                          className="p-2 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition"
                          title="Remove Athlete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Edit Player Modal */}
      <AnimatePresence>
        {editPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditPlayer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-md rounded-2xl p-6 relative z-10 border border-white/10 shadow-2xl"
            >
              <button
                onClick={() => setEditPlayer(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-lg font-bold text-white mb-4">Edit Athlete Profile</h3>
              <p className="text-xs text-gray-400 mb-6">Modify the credentials or progress of this athlete.</p>

              <form onSubmit={handleUpdatePlayer} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Athlete Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Sessions Count (Out of 30)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editSessionsCount}
                    onChange={(e) => setEditSessionsCount(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditPlayer(null)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2.5 px-4 rounded-xl transition text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || !editName.trim()}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2.5 px-4 rounded-xl transition text-sm disabled:opacity-50"
                  >
                    {updating ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletePlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletePlayer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-sm rounded-2xl p-6 relative z-10 border border-red-500/10 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Trash2 className="text-red-400" size={20} />
                Confirm Deletion
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                Are you sure you want to remove <strong className="text-white">{deletePlayer.name}</strong>? This will permanently delete their records and passcode.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletePlayer(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2.5 px-4 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePlayer}
                  disabled={deleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition text-sm disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Player'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
