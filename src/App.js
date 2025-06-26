import React, { useState, useEffect, useMemo, useCallback } from 'react'
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

  // 1) Wrap sortData in a useCallback
  const sortData = useCallback(
    (data) => {
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
    },
    [sortConfig]
  )

  function getRowColor(partyValue = '') {
    const p = partyValue.toLowerCase()

    // EXACT matches
    if (p === 'cpc') return '#639ee0'
    if (p === 'lpc') return '#9d0001'
    if (p === 'pc') return '#00becf'

    // partial matches
    if (p.includes('liberal')) return 'red'
    if (p.includes('ndp')) return 'orange'
    if (p.includes('green')) return 'green'
    if (p.includes('atlantica')) return 'purple'
    return ''
  }

  // 1) Extended getPartyTotals with explicit checks for nsndp, ndp-ca, ndp
function getPartyTotals(data) {
  // Add nsndp and ndp to the totals object
  const totals = {
    pc: 0,
    cpc: 0,
    nsndp: 0,  // for exactly 'nsndp'
    ndp: 0,    // for exactly 'ndp'
    ndpca: 0,  // for exactly 'ndp-ca'
    liberal: 0,
    lpc: 0
  }

  data.forEach((row) => {
    const amountStr = row['Donation'] || '0'
    const amount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0
    const p = (row['Party'] || '').toLowerCase()

    if (p === 'pc') {
      totals.pc += amount
    } else if (p === 'cpc') {
      totals.cpc += amount
    } else if (p === 'nsndp') {
      totals.nsndp += amount
    } else if (p === 'ndp-ca') {
      totals.ndpca += amount
    } else if (p === 'ndp') {
      // strictly 'ndp' goes here
      totals.ndp += amount
    } else if (p.includes('liberal')) {
      totals.liberal += amount
    } else if (p.includes('lpc')) {
      totals.lpc += amount
    }
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

  // 2) UseMemo depends on [filteredData, sortData]
  const sortedFilteredData = useMemo(() => {
    return sortData(filteredData)
  }, [filteredData, sortData])

  // Totals
  const partyTotals = useMemo(() => getPartyTotals(sortedFilteredData), [sortedFilteredData])

  return (
    <div className="min-h-screen w-full p-6 flex flex-col items-center text-white bg-gradient-to-b from-blue-900 to-gray-900">
      <Helmet>
        <title>NSPoli Donors</title>
        <meta name="description" content="Search through political donations in Nova Scotia" />
        <link rel="icon" type="image/png" href={icon} />
        <meta name="robots" content="noindex, nofollow" />
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
        <img src={nspcLogo} alt="PC Party Logo" className="w-10 h-10 rounded-full mr-3" />
        <span className="font-semibold">PC:</span>
        <span className="ml-2">${partyTotals.pc.toFixed(2)}</span>
      </div>

      {/* CPC */}
      <div className="flex items-center">
        <img src={cpcLogo} alt="CPC Logo" className="w-10 h-10 rounded-full mr-3" />
        <span className="font-semibold">CPC:</span>
        <span className="ml-2">${partyTotals.cpc.toFixed(2)}</span>
      </div>

      {/* NSNDP */}
      <div className="flex items-center">
        <img src={nsndpLogo} alt="NSNDP Logo" className="w-10 h-10 rounded-full mr-3" />
        <span className="font-semibold">NSNDP:</span>
        <span className="ml-2">${partyTotals.nsndp.toFixed(2)}</span>
      </div>

      {/* NDPCA */}
      <div className="flex items-center">
        <img src={ndpcaLogo} alt="NDPCA Logo" className="w-10 h-10 rounded-full mr-3" />
        <span className="font-semibold">NDPCA:</span>
        <span className="ml-2">${partyTotals.ndpca.toFixed(2)}</span>
      </div>

      {/* Liberal */}
      <div className="flex items-center">
        <img src={nslpLogo} alt="Liberal Logo" className="w-10 h-10 rounded-full mr-3" />
        <span className="font-semibold">Liberal:</span>
        <span className="ml-2">${partyTotals.liberal.toFixed(2)}</span>
      </div>

      {/* LPC */}
      <div className="flex items-center">
        <img src={lpcLogo} alt="LPC Logo" className="w-10 h-10 rounded-full mr-3" />
        <span className="font-semibold">LPC:</span>
        <span className="ml-2">${partyTotals.lpc.toFixed(2)}</span>
      </div>
    </div>
  </div>
)}


      <div className="text-sm text-center mt-6">
        <p>
          Collected from Elections Nova Scotia covering from 2005-2024. Only donations
          of $200 or more are publicly reported from 2010 onward. Federal data from 2016-2024. Note there may be duplicate records in federal data.
        </p>
        <p className="mt-1">
          Type your Last Name followed by a space, then First Name. Click table headers
          to sort.
        </p>
      </div>
    </div>
  )
}
