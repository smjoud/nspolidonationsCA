import React, { useState, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet'
import Papa from 'papaparse'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'

// Local images from src/assets
import nspcLogo from './assets/nspc_logo.jpg'
import nsndpLogo from './assets/nsndp_logo.jpg'
import nslpLogo from './assets/nslp-logo.png'
import cpcLogo from './assets/cpclogo.png'
import ndpcaLogo from './assets/ndpcalogo.jpg'
import lpcLogo from './assets/lpclogo.jpg'
import icon from './assets/icon.png'

/** Debounce hook to reduce lag when filtering large data */
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

/** Our final, unified columns in a fixed order. */
const allColumns = [
  'Last Name',
  'First Name',
  'Postal Code',
  'City',
  'Party',
  'Specific Campaign',
  'Date',
  'Donation',
]

export default function App() {
  const [csvData, setCsvData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, order: 'asc' })
  function handleSortClick(header) {
    setSortConfig((prev) => {
      if (prev.key === header) {
        return { ...prev, order: prev.order === 'asc' ? 'desc' : 'asc' }
      } else {
        return { key: header, order: 'asc' }
      }
    })
  }

  // Parse & combine both CSVs in one useEffect
  useEffect(() => {
    // 1) Parse data.csv (the provincial file)
    Papa.parse('./data.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (provincialResults) => {
        const provincialData = provincialResults.data.map((row) => ({
          // For data.csv:
          // Last Name, First Name, Town => City, Amount => Donation, Year => Date
          'Last Name': row['Last Name'] || '',
          'First Name': row['First Name'] || '',
          'Postal Code': '', // No postal code in data.csv
          City: row['Town'] || '', // rename 'Town' => 'City'
          Party: row['Party'] || '',
          'Specific Campaign': row['Specific Campaign'] || '',
          Date: row['Year'] || '', // rename 'Year' => 'Date'
          Donation: row['Amount'] || '', // rename 'Amount' => 'Donation'
        }))

        // 2) Parse federaldata.csv
        Papa.parse('./federaldata.csv', {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (federalResults) => {
            const federalData = federalResults.data.map((row) => {
              // Possibly shorten “Conservative Party of Canada” -> “CPC”
              let party = row['Party'] || ''
              if (party.includes('Conservative Party of Canada')) {
                party = 'CPC'
              }
              if (party.includes('Liberal Party of Canada')) {
                party = 'LPC'
              }

              if (party.includes('New Democratic Party')) {
                party = 'NDP-CA'
              }

              let recipient = row['Recipient'] || ''
              if (recipient.includes('Conservative Party of Canada')) {
                recipient = 'CPC'
              }
              if (party.includes('Liberal Party of Canada')) {
                party = 'LPC'
              }
              if (party.includes('New Democratic Party')) {
                party = 'NDP-CA'
              }

              return {
                // For federaldata.csv:
                // Date_received => Date, Monetary => Donation
                'Last Name': row['Last Name'] || '',
                'First Name': row['First Name'] || '',
                'Postal Code': row['Postal Code'] || '',
                City: row['City'] || '',
                Party: party,
                'Specific Campaign': recipient,
                Date: row['Date_received'] || '',
                Donation: row['Monetary'] || '',
              }
            })

            // Combine them
            const combined = [...provincialData, ...federalData]
            setCsvData(combined)
          },
        })
      },
    })
  }, [])

  // Sorting function
  function sortData(data) {
    if (!sortConfig.key) return data
    const { key, order } = sortConfig
    const sorted = [...data].sort((a, b) => {
      let aVal = a[key] ?? ''
      let bVal = b[key] ?? ''

      // numeric parse attempt
      const aNum = parseFloat(String(aVal).replace(/[$,]/g, ''))
      const bNum = parseFloat(String(bVal).replace(/[$,]/g, ''))
      const isNumericA = !isNaN(aNum)
      const isNumericB = !isNaN(bNum)
      if (isNumericA && isNumericB) {
        return order === 'asc' ? aNum - bNum : bNum - aNum
      } else {
        // string compare
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
        if (aVal < bVal) return order === 'asc' ? -1 : 1
        if (aVal > bVal) return order === 'asc' ? 1 : -1
        return 0
      }
    })
    return sorted
  }

  function getRowColor(partyValue = '') {
    const p = partyValue.toLowerCase()
  
    // 1) EXACT matches
    if (p === 'cpc') return '#639ee0'   // dark-ish blue
    if (p === 'lpc') return '#9d0001'   // dark red
    if (p === 'pc')  return '#00becf'   // teal
  
    // 2) partial matches for other common terms
    if (p.includes('liberal')) return 'red'
    if (p.includes('ndp')) return 'orange'
    if (p.includes('green')) return 'green'
    if (p.includes('atlantica')) return 'purple'
  
    return ''
  }
  

  // Summaries
  function getPartyTotals(data) {
    const totals = { pc: 0, ndp: 0, liberal: 0, cpc: 0, ndpca: 0, lpc: 0 }
  
    data.forEach((row) => {
      const amountStr = row['Donation'] || '0'
      const amount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0
      const party = (row['Party'] || '').toLowerCase()
  
      // 1) EXACT match for PC
      if (party === 'pc') {
        totals.pc += amount
      }
      // 2) EXACT match for CPC
      else if (party === 'cpc') {
        totals.cpc += amount
      }
      // 3) If it has 'ndpca', add to ndpca
      else if (party.includes('ndpca')) {
        totals.ndpca += amount
      }
      // 4) If it has 'ndp', add to ndp
      else if (party.includes('ndp')) {
        totals.ndp += amount
      }
      // 5) If it has 'liberal', add to liberal
      else if (party.includes('liberal')) {
        totals.liberal += amount
      }
      // 6) If it has 'lpc', add to lpc
      else if (party.includes('lpc')) {
        totals.lpc += amount
      }
      // else ignore or handle additional logic as needed
    })
  
    return totals
  }
  

  // Filter by "LastName FirstName"
  const filteredData = useMemo(() => {
    if (!debouncedSearch) return []
    const [lastNameSearch, firstNameSearch] = debouncedSearch
      .split(/\s+/, 2)
      .map((s) => s.toLowerCase())

    return csvData.filter((row) => {
      const rowLast = (row['Last Name'] || '').toLowerCase()
      const rowFirst = (row['First Name'] || '').toLowerCase()
      if (!firstNameSearch) {
        return rowLast.includes(lastNameSearch)
      } else {
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

  // Totals
  const partyTotals = useMemo(() => getPartyTotals(sortedFilteredData), [sortedFilteredData])

  return (
    <div className="min-h-screen w-full p-6 flex flex-col items-center text-white bg-gradient-to-b from-blue-900 to-gray-900">
      <Helmet>
        <title>NSPoli Donors</title>
        <link rel="icon" type="image/png" href={icon} />
      </Helmet>

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-extrabold mb-8"
      >
        NSPOLI Donors
      </motion.h1>

      {/* Main card */}
      <div className="w-full max-w-5xl bg-white text-gray-800 rounded-2xl shadow-xl p-6 flex flex-col gap-6">
        {/* Search */}
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

        {/* Table */}
        {debouncedSearch && (
          <div className="overflow-auto border border-gray-200 rounded-md">
            <table className="min-w-full text-left">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  {allColumns.map((header) => (
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
                      {allColumns.map((col) => (
                        <td key={col} className="px-4 py-2">
                          {row[col] ?? ''}
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
                src={nspcLogo}
                alt="PC Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">PC:</span>
              <span className="ml-2">${partyTotals.pc.toFixed(2)}</span>
            </div>
            {/* NDP */}
            <div className="flex items-center">
              <img
                src={nsndpLogo}
                alt="NDP Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">NDP:</span>
              <span className="ml-2">${partyTotals.ndp.toFixed(2)}</span>
            </div>
            {/* Liberal */}
            <div className="flex items-center">
              <img
                src={nslpLogo}
                alt="Liberal Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">Liberal:</span>
              <span className="ml-2">${partyTotals.liberal.toFixed(2)}</span>
            </div>
            {/* CPC */}
            <div className="flex items-center">
              <img
                src={cpcLogo}
                alt="CPC Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">CPC:</span>
              <span className="ml-2">${partyTotals.cpc.toFixed(2)}</span>
            </div>
            {/* NDPCA */}
            <div className="flex items-center">
              <img
                src={ndpcaLogo}
                alt="NDPCA Party Logo"
                className="w-10 h-10 rounded-full mr-3"
              />
              <span className="font-semibold">NDPCA:</span>
              <span className="ml-2">${partyTotals.ndpca.toFixed(2)}</span>
            </div>
            {/* LPC */}
            <div className="flex items-center">
              <img
                src={lpcLogo}
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
        <p className="mt-1">
          Type your Last Name followed by a space, then First Name. Click table headers
          to sort.
        </p>
      </div>
    </div>
  )
}
