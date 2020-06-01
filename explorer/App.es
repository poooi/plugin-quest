import React, { Suspense } from 'react'
import { reactClass as PluginQuest } from '../index'

function App() {
  return (
    <div className="poi bp3-focus-disabled bp3-dark">
      <div className="webview-area" />
      <div className="poi-tab-container">
        <div className="top-nav">
          <div className="poi-tab-contents">
            <Suspense fallback={<div>Loading...</div>}>
              <PluginQuest />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
