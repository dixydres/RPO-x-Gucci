import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-purple-900 to-black">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold text-white">RPO X Gucci</h1>
        <p className="mb-8 text-xl text-gray-300">Ready Player One meets Gucci</p>
        <button
          onClick={() => setCount((count) => count + 1)}
          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
        >
          Count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
