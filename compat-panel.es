import React from 'react'
import { Panel } from 'react-bootstrap'
import PropTypes from 'prop-types'

const CompatPanel = ({ header, children, ...props }) => {
  if (Panel.Body) {
    return (
      <Panel {...props}>
        <Panel.Heading>
          <Panel.Title>
            {header}
          </Panel.Title>
        </Panel.Heading>
        <Panel.Body>
          {children}
        </Panel.Body>
      </Panel>
    )
  }
  return <Panel header={header} {...props}>{children}</Panel>
}

CompatPanel.propTypes = {
  header: PropTypes.node,
  children: PropTypes.node,
}

export default CompatPanel
