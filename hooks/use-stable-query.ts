"use client"

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

interface UseStableQueryOptions {
  queryKey: (string | number | boolean)[]
  queryFn: () => Promise<any>
  enabled?: boolean
  retry?: number
  retryDelay?: number
  staleTime?: number
  cacheTime?: number
  onError?: (error: Error) => void
  onSuccess?: (data: any) => void
}

export function useStableQuery({
  queryKey,
  queryFn,
  enabled = true,
  retry = 3,
  retryDelay = 1000,
  staleTime = 5 * 60 * 1000, // 5 minutes
  cacheTime = 10 * 60 * 1000, // 10 minutes
  onError,
  onSuccess
}: UseStableQueryOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<Error | null>(null)

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const data = await queryFn()
        
        // Reset retry count on success
        setRetryCount(0)
        setLastError(null)
        
        if (onSuccess) {
          onSuccess(data)
        }
        
        return data
      } catch (error) {
        
        const errorObj = error instanceof Error ? error : new Error(String(error))
        setLastError(errorObj)
        
        if (onError) {
          onError(errorObj)
        }
        
        throw errorObj
      }
    },
    enabled,
    retry: (failureCount, error) => {
      if (failureCount >= retry) {
        return false
      }
      
      setRetryCount(failureCount)
      return true
    },
    retryDelay: (attemptIndex) => Math.min(retryDelay * Math.pow(2, attemptIndex), 30000),
    staleTime,
    gcTime: cacheTime, // Updated from cacheTime to gcTime in newer TanStack Query
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: true,
    refetchOnReconnect: true,
    // Keep previous data while refetching
    keepPreviousData: true,
    // Don't throw errors to prevent component unmounting
    throwOnError: false
  })

  const manualRetry = useCallback(() => {
    setRetryCount(0)
    setLastError(null)
    queryClient.invalidateQueries({ queryKey })
  }, [queryKey, queryClient])

  const clearError = useCallback(() => {
    setLastError(null)
    setRetryCount(0)
  }, [])

  // Show toast for persistent errors
  useEffect(() => {
    if (query.error && retryCount >= retry && !query.isFetching) {
      const errorMessage = query.error instanceof Error ? query.error.message : 'An error occurred'
      
      toast({
        title: "Data Loading Error",
        description: `Failed to load data after ${retry} attempts. ${errorMessage}. Click to retry.`,
        variant: "destructive"
      })
    }
  }, [query.error, retryCount, retry, query.isFetching, toast, manualRetry])

  return {
    ...query,
    retryCount,
    lastError,
    manualRetry,
    clearError,
    // Provide a stable data reference
    data: query.data,
    // Enhanced loading state
    isLoading: query.isLoading || (query.isFetching && !query.data),
    // Enhanced error state
    isError: query.isError && retryCount >= retry,
    // Success state
    isSuccess: query.isSuccess && !query.isError
  }
}

// Hook for handling multiple related queries
export function useStableQueries(queries: UseStableQueryOptions[]) {
  const results = queries.map(query => useStableQuery(query))
  
  const isLoading = results.some(result => result.isLoading)
  const isError = results.some(result => result.isError)
  const isSuccess = results.every(result => result.isSuccess)
  
  const retryAll = useCallback(() => {
    results.forEach(result => result.manualRetry())
  }, [results])
  
  const clearAllErrors = useCallback(() => {
    results.forEach(result => result.clearError())
  }, [results])
  
  return {
    results,
    isLoading,
    isError,
    isSuccess,
    retryAll,
    clearAllErrors
  }
}
