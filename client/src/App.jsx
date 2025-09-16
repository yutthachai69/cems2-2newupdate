import { Routes, Route, Navigate } from 'react-router-dom'
import SideBarLayout from './components/SideBarLayout'
import Home from './pages/Home'
import Status from './pages/Status'
import DataLogs from './pages/DataLogs'
import Blowback from './pages/Blowback'
import Graph from './pages/Graph'
import Config from './pages/Config'



export default function App() {
  return (
    <SideBarLayout>
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Home />} />
      <Route path="/status" element={<Status />} />
      <Route path="/logs" element={<DataLogs />} />
      <Route path="/blowback" element={<Blowback />} />
      <Route path="/graph" element={<Graph />} />
      <Route path="/config" element={<Config />} />
      <Route path="*" element={<h1>404 Not Found</h1>} />
    </Routes>
    </SideBarLayout>
  )
}