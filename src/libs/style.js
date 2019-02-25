import colors from 'src/libs/colors'


export const standardShadow = '0 3px 2px 0 rgba(0,0,0,0.12)'
export const modalShadow = '0 0 8px 0 rgba(0,0,0,0.12), 0 8px 8px 0 rgba(0,0,0,0.24)'

export const standardLine = `1px solid ${colors.gray[2]}`

export const elements = {
  card: {
    title: { color: colors.green[0], fontSize: 16, overflow: 'hidden' },
    container: {
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      borderRadius: 5, padding: '1rem', wordWrap: 'break-word',
      backgroundColor: 'white',
      boxShadow: '0 2px 5px 0 rgba(0,0,0,0.35), 0 3px 2px 0 rgba(0,0,0,0.12), 0 0 2px 0 rgba(0,0,0,0.12)'
    }
  },
  sectionHeader: { color: colors.gray[0], fontSize: 16, fontWeight: 'bold' },
  pageContentContainer: { position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column' }
}

export const tabBar = {
  container: {
    display: 'flex', alignItems: 'center', backgroundColor: colors.grayBlue[6],
    fontWeight: 500, textTransform: 'uppercase',
    height: '3.75rem', paddingRight: '1rem',
    borderBottom: `2px solid ${colors.green[1]}`, flex: 'none',
    boxShadow: '0 2px 5px 0 rgba(0,0,0,0.25)', zIndex: 1
  },
  tab: {
    minWidth: 140, flexGrow: 0, padding: '0 20px',
    color: colors.green[0],
    alignSelf: 'stretch', display: 'flex', justifyContent: 'center', alignItems: 'center'
  },
  active: {
    backgroundColor: colors.green[6], color: 'unset',
    borderBottomWidth: 8, borderBottomStyle: 'solid', borderBottomColor: colors.green[1],
    fontWeight: 600
  },
  hover: {
    backgroundColor: colors.green[6], color: colors.green[1]
  }
}
