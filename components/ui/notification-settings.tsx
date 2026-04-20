"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Volume2, VolumeX, Bell } from 'lucide-react'
import { useNotificationSound } from '@/hooks/use-notification-sound'

interface NotificationSettingsProps {
  className?: string
}

export function NotificationSettings({ className = "" }: NotificationSettingsProps) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  // Test the notification sound
  const { playSound } = useNotificationSound({ 
    notifications: [], 
    enableSound: false // Don't auto-play, we'll trigger manually
  })

  const handleToggleSound = (checked: boolean) => {
    setSoundEnabled(checked)
    // Store preference in localStorage
    localStorage.setItem('notification-sound-enabled', checked.toString())
  }

  const handleTestSound = async () => {
    setIsPlaying(true)
    
    // Create a temporary audio instance for testing
    const testAudio = new Audio('/sound.pm3.mp3')
    testAudio.volume = 0.7
    
    try {
      await testAudio.play()
    } catch (error) {
    }
    
    // Reset playing state after 1 second
    setTimeout(() => setIsPlaying(false), 1000)
  }

  useEffect(() => {
    // Load saved preference
    const savedPreference = localStorage.getItem('notification-sound-enabled')
    if (savedPreference !== null) {
      setSoundEnabled(savedPreference === 'true')
    }
  }, [])

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        {soundEnabled ? (
          <Volume2 className="h-4 w-4 text-green-600" />
        ) : (
          <VolumeX className="h-4 w-4 text-gray-400" />
        )}
        <span className="text-sm font-medium">
          Notification Sound
        </span>
      </div>
      
      <Switch
        checked={soundEnabled}
        onCheckedChange={handleToggleSound}
        className="data-[state=checked]:bg-[#0891B2]"
      />
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleTestSound}
        disabled={isPlaying}
        className="text-xs"
      >
        {isPlaying ? (
          <>Playing...</>
        ) : (
          <>
            <Bell className="h-3 w-3 mr-1" />
            Test
          </>
        )}
      </Button>
    </div>
  )
}
