import React, { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

/** Debounce hook to reduce lag when filtering large data */
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export default function App() {
  const [csvData, setCsvData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  // --- Sorting State
  const [sortConfig, setSortConfig] = useState({ key: null, order: 'asc' })

  // Handle column header clicks
  function handleSortClick(header) {
    setSortConfig((prev) => {
      if (prev.key === header) {
        // Toggle asc <-> desc
        return { ...prev, order: prev.order === 'asc' ? 'desc' : 'asc' }
      } else {
        // New header, reset to ascending
        return { key: header, order: 'asc' }
      }
    })
  }

  // Sorting function that sorts by sortConfig
  function sortData(data) {
    if (!sortConfig.key) return data // no sort if no column chosen

    const { key, order } = sortConfig
    const sorted = [...data].sort((a, b) => {
      let aVal = a[key] ?? ''
      let bVal = b[key] ?? ''

      // Attempt numeric parse
      const aNum = parseFloat(String(aVal).replace(/[$,]/g, ''))
      const bNum = parseFloat(String(bVal).replace(/[$,]/g, ''))
      const isNumericA = !isNaN(aNum)
      const isNumericB = !isNaN(bNum)

      if (isNumericA && isNumericB) {
        return order === 'asc' ? aNum - bNum : bNum - aNum
      } else {
        // string compare
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
        if (aVal < bVal) return order === 'asc' ? -1 : 1
        if (aVal > bVal) return order === 'asc' ? 1 : -1
        return 0
      }
    })
    return sorted
  }

  // Fetch & parse CSV from GitHub
  useEffect(() => {
    Papa.parse(
      'https://raw.githubusercontent.com/smjoud/NSpolidonations/main/data.csv',
      {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => setCsvData(results.data),
      }
    )
  }, [])

  // Color rows by party
  function getRowColor(partyValue = '') {
    const p = partyValue.toLowerCase()
    if (p.includes('pc')) return '#639ee0'
    if (p.includes('liberal')) return 'red'
    if (p.includes('ndp')) return 'orange'
    if (p.includes('green')) return 'green'
    if (p.includes('atlantica')) return 'purple'
    return ''
  }

  // Summarize donations by party
  function getPartyTotals(data) {
    const totals = { pc: 0, ndp: 0, liberal: 0, cpc: 0, ndpca: 0, lpc: 0 }
    data.forEach((row) => {
      const amountStr = row['Amount'] || row['Donation'] || '0'
      const amount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0
      const party = (row['Party'] || '').toLowerCase()
      if (party.includes('pc')) totals.pc += amount
      if (party.includes('ndpca')) totals.ndpca += amount
      if (party.includes('ndp')) totals.ndp += amount
      if (party.includes('liberal')) totals.liberal += amount
      if (party.includes('cpc')) totals.cpc += amount
      if (party.includes('lpc')) totals.lpc += amount
    })
    return totals
  }

  // Specialized Search: "LastName FirstName" approach
  const filteredData = useMemo(() => {
    if (!debouncedSearch) return []
    // Split user input into at most two parts: [lastName, firstName]
    const [lastNameSearch, firstNameSearch] = debouncedSearch
      .split(/\s+/, 2)
      .map((s) => s.toLowerCase())

    return csvData.filter((row) => {
      const rowLast = (row['Last Name'] || '').toLowerCase()
      const rowFirst = (row['First Name'] || '').toLowerCase()

      if (!firstNameSearch) {
        // Only last name given
        return rowLast.includes(lastNameSearch)
      } else {
        // last & first name given
        return (
          rowLast.includes(lastNameSearch) &&
          rowFirst.includes(firstNameSearch)
        )
      }
    })
  }, [debouncedSearch, csvData])

  // Sort the filtered data
  const sortedFilteredData = useMemo(() => {
    return sortData(filteredData)
  }, [filteredData, sortConfig])

  // Totals for the final data shown
  const partyTotals = useMemo(() => getPartyTotals(sortedFilteredData), [sortedFilteredData])

  return (
    <div
      className={`
        min-h-screen w-full p-6 flex flex-col items-center text-white
        bg-gradient-to-b from-blue-900 to-gray-900
      `}
    >
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-extrabold mb-8"
      >
        NSPOLI Donors
      </motion.h1>

      {/* Main card */}
      <div className="w-full max-w-3xl bg-white text-gray-800 rounded-2xl shadow-xl p-6 flex flex-col gap-6">
        {/* Search field */}
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter 'LastName FirstName'"
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {debouncedSearch && (
          <div className="overflow-auto border border-gray-200 rounded-md">
            <table className="min-w-full text-left">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  {sortedFilteredData.length > 0 &&
                    Object.keys(sortedFilteredData[0]).map((header) => (
                      <th
                        key={header}
                        onClick={() => handleSortClick(header)}
                        className="px-4 py-2 text-gray-700 font-semibold cursor-pointer select-none"
                      >
                        {header}
                        {sortConfig.key === header && (
                          <span className="ml-1 text-xs">
                            {sortConfig.order === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {sortedFilteredData.map((row, index) => {
                  const partyValue = row['Party'] || ''
                  return (
                    <tr
                      key={index}
                      className="border-b hover:bg-gray-50 transition-colors"
                      style={{ backgroundColor: getRowColor(partyValue) || undefined }}
                    >
                      {Object.values(row).map((val, i) => (
                        <td key={i} className="px-4 py-2">
                          {val}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary card */}
      {debouncedSearch && (
        <div className="mt-6 w-full max-w-3xl bg-white text-gray-800 rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold mb-4">Total Amount Donated</h2>
          <div className="space-y-4">
            {/* PC */}
            <div className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/smjoud/NSpolidonations/main/img/nspc_logo.jpg"
                alt="PC Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">PC:</span>
              <span className="ml-2">${partyTotals.pc.toFixed(2)}</span>
            </div>
            {/* NDP */}
            <div className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/smjoud/NSpolidonations/main/img/nsndp_logo.jpg"
                alt="NDP Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">NDP:</span>
              <span className="ml-2">${partyTotals.ndp.toFixed(2)}</span>
            </div>
            {/* Liberal */}
            <div className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/smjoud/NSpolidonations/main/img/nslp-logo.png"
                alt="Liberal Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">Liberal:</span>
              <span className="ml-2">${partyTotals.liberal.toFixed(2)}</span>
            </div>
            {/* CPC */}
            <div className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/smjoud/NSpolidonations/main/img/cpclogo.png"
                alt="CPC Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">CPC:</span>
              <span className="ml-2">${partyTotals.cpc.toFixed(2)}</span>
            </div>
            {/* NDPCA */}
            <div className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/smjoud/NSpolidonations/main/img/ndpcalogo.jpg"
                alt="NDPCA Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">NDPCA:</span>
              <span className="ml-2">${partyTotals.ndpca.toFixed(2)}</span>
            </div>
            {/* LPC */}
            <div className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/smjoud/NSpolidonations/main/img/lpclogo.jpg"
                alt="Liberal Party of Canada Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">LPC:</span>
              <span className="ml-2">${partyTotals.lpc.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-center mt-6">
        <p>
          Collected from Elections Nova Scotia covering from 2005-2023. Only donations
          of $200 or more are publicly reported from 2010 onward.
        </p>
        <p className="mt-1">Type your Last Name followed by a space, then First Name. Click table headers to sort.</p>
      </div>
    </div>
  )
}
