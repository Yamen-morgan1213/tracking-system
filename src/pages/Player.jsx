import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  KeyRound, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  Flame 
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function Player() {
  const [passcode, setPasscode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successPlayer, setSuccessPlayer] = useState(null)
  const [particles, setParticles] = useState([])

  const triggerConfetti = () => {
    const newParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: 0,
      y: 0,
      angle: Math.random() * Math.PI * 2,
      velocity: Math.random() * 10 + 5,
      color: ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899'][Math.floor(Math.random() * 5)],
      size: Math.random() * 8 + 4
    }))
    setParticles(newParticles)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (passcode.length !== 5) {
      toast.error('Passcode must be exactly 5 characters')
      return
    }

    setSubmitting(true)
    const upperPasscode = passcode.toUpperCase().trim()

    try {
      // 1. Find the player by passcode
      const { data: player, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('passcode', upperPasscode)
        .single()

      if (fetchError || !player) {
        toast.error('Invalid passcode. Please check with Coach.')
        setSubmitting(false)
        return
      }

      // 2. Validate 12-hour limit restriction
      const now = new Date()
      if (player.last_login) {
        const lastLogin = new Date(player.last_login)
        const diffInMs = now - lastLogin
        const diffInHours = diffInMs / (1000 * 60 * 60)

        if (diffInHours < 12) {
          toast.error('Session already recorded. Please wait 12 hours.')
          setSubmitting(false)
          return
        }
      }

      // 3. Calculate new session count (milestone reset at 30)
      let newCount = player.sessions_count + 1
      if (player.sessions_count >= 30) {
        newCount = 1 // Reset to 0 then increment by 1
      }

      // 4. Update the player session records
      const { error: updateError } = await supabase
        .from('players')
        .update({
          sessions_count: newCount,
          last_login: now.toISOString()
        })
        .eq('id', player.id)

      if (updateError) throw updateError

      const updatedPlayer = {
        ...player,
        sessions_count: newCount,
        last_login: now.toISOString()
      }

      setSuccessPlayer(updatedPlayer)
      triggerConfetti()
      setPasscode('')
    } catch (error) {
      console.error('Error logging attendance:', error)
      toast.error('Failed to log session. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    // Filter to only alphanumeric characters and force uppercase
    const filtered = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    if (filtered.length <= 5) {
      setPasscode(filtered)
    }
  }

  const closeSuccessScreen = () => {
    setSuccessPlayer(null)
    setParticles([])
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 relative overflow-hidden bg-[#030712]">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#06b6d4]/5 blur-3xl pointer-events-none" />

      {/* Top Brand Info */}
      <div className="text-center pt-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Athlete Portal</h2>
        <h1 className="text-2xl font-black text-white mt-1">Muhammad El-Sayed</h1>
      </div>

      {/* Main Check-In Form */}
      <div className="w-full max-w-md mx-auto my-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-8 border border-white/5 shadow-2xl relative"
        >
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <KeyRound size={24} />
          </div>

          <h3 className="text-xl font-bold text-center text-white">Record Attendance</h3>
          <p className="text-xs text-gray-400 text-center mt-1.5 mb-8">
            Enter your unique 5-character passcode to mark today's session.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={passcode}
                onChange={handleInputChange}
                placeholder="ABCDE"
                maxLength={5}
                required
                className="w-full text-center text-4xl font-mono tracking-[0.4em] py-4 rounded-2xl glass-input border border-white/10 placeholder-gray-800 uppercase focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || passcode.length !== 5}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-2xl shadow-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
            >
              {submitting ? 'Verifying...' : 'Record Session'}
              {!submitting && <ChevronRight size={18} />}
            </button>
          </form>
        </motion.div>
      </div>

      {/* Footer Branding */}
      <div className="text-center pb-4 text-[10px] text-gray-500 tracking-wider">
        DEVELOPED BY COACH MUHAMMAD EL-SAYED • POWERED BY SUPABASE
      </div>

      {/* Massive Fullscreen Success Screen */}
      <AnimatePresence>
        {successPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
            {/* Confetti Particle canvas wrapper */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    backgroundColor: p.color,
                    width: p.size,
                    height: p.size,
                    left: '50%',
                    top: '50%'
                  }}
                  animate={{
                    x: Math.cos(p.angle) * p.velocity * 40,
                    y: Math.sin(p.angle) * p.velocity * 40 + 200,
                    opacity: 0,
                    scale: 0
                  }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-sm rounded-3xl p-8 border border-white/10 shadow-2xl text-center relative z-10"
            >
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 relative">
                <CheckCircle2 size={40} className="animate-scale" />
                <Sparkles size={18} className="absolute -top-1 -right-1 text-teal-400 animate-pulse" />
              </div>

              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                Attendance Recorded!
              </h2>
              <p className="text-gray-400 text-sm mt-1">Great job today,</p>
              <h3 className="text-xl font-bold text-white mt-1 break-all line-clamp-1">
                {successPlayer.name}
              </h3>

              {/* Progress Milestones Visual Card */}
              <div className="mt-8 mb-8 bg-black/40 rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                {/* Glowing neon elements */}
                <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />

                <div className="flex justify-between items-center text-xs font-semibold text-gray-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Flame size={14} className="text-orange-500" />
                    Coach Goal Progress
                  </span>
                  <span className="text-white">
                    {successPlayer.sessions_count} / 30
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min((successPlayer.sessions_count / 30) * 100, 100)}%` }}
                  />
                </div>

                {/* Milestone celebration warning */}
                {successPlayer.sessions_count >= 30 ? (
                  <p className="text-[11px] text-yellow-400 mt-3 font-semibold animate-pulse">
                    🏆 Goal Achieved! Next check-in starts your new milestone streak.
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-500 mt-3">
                    {30 - successPlayer.sessions_count} more sessions to reach your next milestone medal.
                  </p>
                )}
              </div>

              <button
                onClick={closeSuccessScreen}
                className="w-full py-4 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-2xl shadow-lg transition duration-200 text-xs uppercase tracking-wider"
              >
                Close & Next Player
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
