import { useEffect, useRef } from 'react'

interface NotificationSoundHookProps {
  notifications: any[]
  enableSound?: boolean
}

export function useNotificationSound({ notifications, enableSound = true }: NotificationSoundHookProps) {
  const previousNotificationCount = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Check user preference from localStorage
    const userPrefersSound = localStorage.getItem('notification-sound-enabled')
    const shouldEnableSound = enableSound && userPrefersSound !== 'false'

    // Initialize audio
    if (shouldEnableSound && typeof window !== 'undefined') {
      audioRef.current = new Audio('/sound.pm3.mp3')
      audioRef.current.preload = 'auto'
      
      // Optional: Set volume (0.0 to 1.0)
      audioRef.current.volume = 0.7
      
      // Handle audio loading errors gracefully
      audioRef.current.addEventListener('error', () => {
        console.warn('Notification sound file could not be loaded. Please check if /sound.pm3.mp3 exists in the public directory.')
      })

    }

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [enableSound])

  useEffect(() => {
    // Check user preference from localStorage
    const userPrefersSound = localStorage.getItem('notification-sound-enabled')
    const shouldEnableSound = enableSound && userPrefersSound !== 'false'

    if (!shouldEnableSound || !audioRef.current || previousNotificationCount.current === 0) {
      // Skip first load - only play sound for new notifications
      previousNotificationCount.current = notifications.length
      return
    }

    const currentCount = notifications.length
    const previousCount = previousNotificationCount.current

    // Check if there are new notifications
    if (currentCount > previousCount) {
      
      // Play the notification sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0 // Reset to beginning
        audioRef.current.play().catch(error => {
          // Try to play again after user interaction
          // This handles browser autoplay restrictions
          const playOnInteraction = () => {
            audioRef.current?.play().catch(console.warn)
            document.removeEventListener('click', playOnInteraction)
            document.removeEventListener('keydown', playOnInteraction)
          }
          document.addEventListener('click', playOnInteraction)
          document.addEventListener('keydown', playOnInteraction)
        })
      }
    }

    // Update the previous count
    previousNotificationCount.current = currentCount
  }, [notifications.length, enableSound])

  return {
    playSound: () => {
      if (audioRef.current && enableSound) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(error => {
          console.warn('Could not play notification sound:', error)
        })
      }
    }
  }
}
