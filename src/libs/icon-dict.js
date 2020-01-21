import {
  faClipboard, faClock, faClone, faEye, faFolder, faFolderOpen, faListAlt, faSquare as faSquareRegular, faTimesCircle
} from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft, faArrowRight, faBan, faCaretDown, faChalkboard, faCheck, faCheckCircle, faCheckSquare, faCircle, faCloud, faCog, faCreditCard,
  faDownload, faEllipsisV, faExclamationCircle, faExclamationTriangle, faFileInvoiceDollar, faGripHorizontal, faInfoCircle, faLock,
  faLongArrowAltDown, faLongArrowAltUp, faMinusCircle, faPause, faPen, faPlay, faPlus, faPlusCircle, faQuestionCircle, faSearch, faShareAlt,
  faSquare as faSquareSolid, faTerminal, faTrashAlt
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
import { ReactComponent as cloudUpload } from 'src/icons/cloud-upload-solid.svg'
import { ReactComponent as columnGrabber } from 'src/icons/column_grabber.svg'
import { ReactComponent as downloadRegular } from 'src/icons/download-regular.svg'
import { ReactComponent as externalLinkAlt } from 'src/icons/external-link-alt-regular.svg'
import { ReactComponent as fileExport } from 'src/icons/file-export-regular.svg'
import { ReactComponent as list } from 'src/icons/list-regular.svg'
import { ReactComponent as loadingSpinner } from 'src/icons/loading-spinner.svg'
import { ReactComponent as renameIcon } from 'src/icons/rename-icon.svg'
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
  ban: fa(faBan),
  bars: custom(bars),
  chalkboard: fa(faChalkboard),
  check: fa(faCheck),
  clock: fa(faClock),
  cloud: fa(faCloud),
  cog: fa(faCog),
  copy: fa(faClone),
  'copy-to-clipboard': fa(faClipboard),
  download: fa(faDownload),
  downloadRegular: custom(downloadRegular),
  edit: fa(faPen),
  'error-standard': fa(faExclamationCircle),
  export: custom(fileExport),
  eye: fa(faEye),
  folder: fa(faFolder),
  'folder-open': fa(faFolderOpen),
  help: fa(faQuestionCircle),
  'info-circle': fa(faInfoCircle),
  library: custom(books),
  lock: fa(faLock),
  'long-arrow-alt-down': fa(faLongArrowAltDown),
  'long-arrow-alt-up': fa(faLongArrowAltUp),
  'minus-circle': fa(faMinusCircle),
  pause: fa(faPause),
  play: fa(faPlay),
  plus: fa(faPlus),
  'plus-circle': fa(faPlusCircle),
  'pop-out': custom(externalLinkAlt),
  search: fa(faSearch),
  share: fa(faShareAlt),
  'success-standard': fa(faCheckCircle),
  sync: custom(syncAlt),
  terminal: props => fa(faTerminal, { mask: faSquareSolid, transform: 'shrink-8', ...props }),
  times: custom(times),
  'times-circle': fa(faTimesCircle),
  trash: fa(faTrashAlt),
  'upload-cloud': custom(cloudUpload),
  'view-cards': fa(faGripHorizontal),
  'view-list': custom(list),
  'warning-standard': fa(faExclamationTriangle),
  'ellipsis-v': fa(faEllipsisV),
  arrowLeft: fa(faArrowLeft),
  arrowLeftRegular: custom(arrowLeftRegular),
  arrowRight: fa(faArrowRight),
  cardMenuIcon: custom(cardMenuIcon),
  'ellipsis-v-circle': props => fa(faEllipsisV, { mask: faCircle, transform: 'shrink-8', ...props }),
  caretDown: fa(faCaretDown),
  checkSquare: fa(faCheckSquare),
  columnGrabber: custom(columnGrabber),
  creditCard: fa(faCreditCard),
  listAlt: fa(faListAlt),
  loadingSpinner: custom(loadingSpinner),
  purchaseOrder: fa(faFileInvoiceDollar),
  renameIcon: custom(renameIcon),
  square: fa(faSquareRegular)
}

export default iconDict
