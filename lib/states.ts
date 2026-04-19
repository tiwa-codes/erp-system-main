import statesData from '@/public/nigerian-states.json'

export interface StateData {
  [stateName: string]: string[]
}

export interface State {
  name: string
  lgas: string[]
}

export interface LGA {
  name: string
  state: string
}

// Get all states
export function getStates(): State[] {
  return Object.keys(statesData).map(stateName => ({
    name: stateName,
    lgas: (statesData as StateData)[stateName]
  }))
}

// Get state names only
export function getStateNames(): string[] {
  return Object.keys(statesData)
}

// Get LGAs for a specific state
export function getLGAsForState(stateName: string): string[] {
  return (statesData as StateData)[stateName] || []
}

// Get all LGAs with their states
export function getAllLGAs(): LGA[] {
  const lgas: LGA[] = []
  Object.entries(statesData).forEach(([stateName, lgaNames]) => {
    lgaNames.forEach(lgaName => {
      lgas.push({
        name: lgaName,
        state: stateName
      })
    })
  })
  return lgas
}

// Validate if a state exists
export function isValidState(stateName: string): boolean {
  return stateName in statesData
}

// Validate if an LGA exists in a specific state
export function isValidLGA(lgaName: string, stateName: string): boolean {
  const stateLGAs = getLGAsForState(stateName)
  return stateLGAs.includes(lgaName)
}

// Search LGAs by name
export function searchLGAs(query: string): LGA[] {
  const lowerQuery = query.toLowerCase()
  return getAllLGAs().filter(lga => 
    lga.name.toLowerCase().includes(lowerQuery)
  )
}

// Get state statistics
export function getStateStats() {
  const states = getStates()
  const totalLGAs = states.reduce((sum, state) => sum + state.lgas.length, 0)
  
  return {
    totalStates: states.length,
    totalLGAs,
    averageLGAsPerState: Math.round(totalLGAs / states.length)
  }
}
