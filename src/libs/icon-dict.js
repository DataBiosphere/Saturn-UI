import { faClipboard, faClock, faClone, faEye, faFileAlt, faFolder, faFolderOpen, faListAlt, faTimesCircle } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft,
  faArrowRight,
  faBan,
  faCaretDown,
  faChalkboard,
  faCheck,
  faCheckCircle,
  faCircle,
  faClock as faClockSolid,
  faCloud,
  faCog,
  faCreditCard,
  faDownload,
  faEllipsisV,
  faExclamationCircle,
  faExclamationTriangle,
  faFileInvoiceDollar,
  faGripHorizontal,
  faInfoCircle,
  faLock,
  faLongArrowAltDown,
  faLongArrowAltUp,
  faMinusCircle,
  faMoneyCheckAlt,
  faPause,
  faPen,
  faPlay,
  faPlus,
  faPlusCircle,
  faQuestion,
  faQuestionCircle,
  faRocket,
  faSearch,
  faShareAlt,
  faSquare as faSquareSolid,
  faTachometerAlt,
  faTasks,
  faTerminal,
  faTrashAlt,
  faVirus
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import _ from 'lodash/fp'
import { h } from 'react-hyperscript-helpers'
import { ReactComponent as angleDoubleUp } from 'src/icons/angle-double-up-regular.svg'
import { ReactComponent as angleUp } from 'src/icons/angle-up-regular.svg'
import { ReactComponent as arrowLeftRegular } from 'src/icons/arrow-left-regular.svg'
import { ReactComponent as bars } from 'src/icons/bars-light.svg'
import { ReactComponent as books } from 'src/icons/books-solid.svg'
import { ReactComponent as cardMenuIcon } from 'src/icons/card-menu-icon.svg'
import { ReactComponent as faCloudBolt } from 'src/icons/cloud-compute.svg'
import { ReactComponent as cloudUpload } from 'src/icons/cloud-upload-solid.svg'
import { ReactComponent as columnGrabber } from 'src/icons/column_grabber.svg'
import { ReactComponent as copySolid } from 'src/icons/copy-solid.svg'
import { ReactComponent as downloadRegular } from 'src/icons/download-regular.svg'
import { ReactComponent as externalLinkAlt } from 'src/icons/external-link-alt-regular.svg'
import { ReactComponent as fileExport } from 'src/icons/file-export-regular.svg'
import { ReactComponent as fileSearchSolid } from 'src/icons/file-search-solid.svg'
import { ReactComponent as infoCircleRegular } from 'src/icons/info-circle-regular.svg'
import { ReactComponent as list } from 'src/icons/list-regular.svg'
import { ReactComponent as loadingSpinner } from 'src/icons/loading-spinner.svg'
import { ReactComponent as renameIcon } from 'src/icons/rename-icon.svg'
import { ReactComponent as squareLight } from 'src/icons/square-light.svg'
import { ReactComponent as syncAlt } from 'src/icons/sync-alt-regular.svg'
import { ReactComponent as times } from 'src/icons/times-light.svg'


const fa = _.curry((shape, { size, ...props }) => h(FontAwesomeIcon, _.merge({ icon: shape, style: { height: size, width: size } }, props)))
const custom = _.curry((shape, { size, ...props }) => h(shape,
  _.merge({ 'aria-hidden': true, focusable: false, style: { height: size, width: size } }, props)))

const rotate = _.curry((rotation, shape, props) => shape(_.merge({ style: { transform: `rotate(${rotation}deg)` } }, props)))

const iconDict = {
  'angle-down': rotate(180, custom(angleUp)),
  'angle-left': rotate(-90, custom(angleUp)),
  'angle-right': rotate(90, custom(angleUp)),
  'angle-up': custom(angleUp),
  'angle-double-left': rotate(-90, custom(angleDoubleUp)),
  'angle-double-right': rotate(90, custom(angleDoubleUp)),
  arrowLeft: fa(faArrowLeft),
  arrowLeftRegular: custom(arrowLeftRegular),
  arrowRight: fa(faArrowRight),
  ban: fa(faBan),
  bars: custom(bars),
  cardMenuIcon: custom(cardMenuIcon),
  caretDown: fa(faCaretDown),
  chalkboard: fa(faChalkboard),
  check: fa(faCheck),
  clock: fa(faClock),
  clockSolid: fa(faClockSolid),
  cloud: fa(faCloud),
  cloudBolt: custom(faCloudBolt),
  cog: fa(faCog),
  columnGrabber: custom(columnGrabber),
  copy: fa(faClone),
  copySolid: custom(copySolid),
  'copy-to-clipboard': fa(faClipboard),
  creditCard: fa(faCreditCard),
  download: fa(faDownload),
  downloadRegular: custom(downloadRegular),
  edit: fa(faPen),
  'ellipsis-v': fa(faEllipsisV),
  'ellipsis-v-circle': props => fa(faEllipsisV, { mask: faCircle, transform: 'shrink-8', ...props }),
  'error-standard': fa(faExclamationCircle),
  export: custom(fileExport),
  eye: fa(faEye),
  fileAlt: fa(faFileAlt),
  fileSearchSolid: custom(fileSearchSolid),
  folder: fa(faFolder),
  'folder-open': fa(faFolderOpen),
  help: fa(faQuestionCircle),
  'info-circle': fa(faInfoCircle),
  'info-circle-regular': custom(infoCircleRegular),
  library: custom(books),
  listAlt: fa(faListAlt),
  loadingSpinner: custom(loadingSpinner),
  lock: fa(faLock),
  'long-arrow-alt-down': fa(faLongArrowAltDown),
  'long-arrow-alt-up': fa(faLongArrowAltUp),
  'minus-circle': fa(faMinusCircle),
  'money-check-alt': fa(faMoneyCheckAlt),
  pause: fa(faPause),
  play: fa(faPlay),
  plus: fa(faPlus),
  'plus-circle': fa(faPlusCircle),
  'lighter-plus-circle': props => fa(faPlus, { mask: faCircle, transform: 'shrink-6', ...props }),
  'pop-out': custom(externalLinkAlt),
  purchaseOrder: fa(faFileInvoiceDollar),
  question: fa(faQuestion),
  renameIcon: custom(renameIcon),
  rocket: fa(faRocket),
  search: fa(faSearch),
  share: fa(faShareAlt),
  squareLight: custom(squareLight),
  squareSolid: fa(faSquareSolid),
  'success-standard': fa(faCheckCircle),
  sync: custom(syncAlt),
  tachometer: fa(faTachometerAlt),
  tasks: fa(faTasks),
  terminal: props => fa(faTerminal, { mask: faSquareSolid, transform: 'shrink-8', ...props }),
  times: custom(times),
  'times-circle': fa(faTimesCircle),
  trash: fa(faTrashAlt),
  'upload-cloud': custom(cloudUpload),
  'view-cards': fa(faGripHorizontal),
  'view-list': custom(list),
  virus: fa(faVirus),
  'warning-standard': fa(faExclamationTriangle)
}

export default iconDict
