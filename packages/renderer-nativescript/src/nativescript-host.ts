/**
 * Concrete {@link NativeHost} over `@nativescript/core` views. This module must
 * only be imported inside a running NativeScript application; importing it in
 * Node or Vitest fails because `@nativescript/core` requires the app runtime.
 * It is exported through the `@orikit/renderer-nativescript/host` subpath so the
 * renderer contract stays loadable everywhere else.
 */
import {
  AbsoluteLayout,
  ActivityIndicator,
  Button,
  Color,
  ContentView,
  DockLayout,
  FlexboxLayout,
  FormattedString,
  GridLayout,
  HtmlView,
  Image,
  Label,
  LayoutBase,
  ListPicker,
  ListView,
  Page,
  Progress,
  ScrollView,
  SearchBar,
  SegmentedBar,
  SegmentedBarItem,
  Slider,
  Span,
  StackLayout,
  Switch,
  TextField,
  TextView,
  type View,
  WrapLayout,
} from '@nativescript/core'
import type { NativeElementKind, NativeHost, RendererLocalState } from './types'

type Apply = (view: View, value: unknown) => void

const colorOf = (value: unknown): Color | undefined =>
  value === undefined || value === null
    ? undefined
    : value instanceof Color
      ? value
      : new Color(value as string)

const lengthOf = (value: unknown): string | number | undefined =>
  value === undefined || value === null ? undefined : (value as string | number)

const setStyle =
  (name: 'color' | 'backgroundColor' | 'tintColor' | 'placeholderColor'): Apply =>
  (view, value) => {
    view.style[name] = colorOf(value) as never
  }

const setStyleValue =
  (
    name:
      | 'fontSize'
      | 'fontWeight'
      | 'fontStyle'
      | 'fontFamily'
      | 'textAlignment'
      | 'letterSpacing'
      | 'lineHeight'
      | 'textDecoration'
      | 'textTransform'
      | 'whiteSpace'
      | 'maxLines'
      | 'alignSelf'
      | 'flexDirection'
      | 'flexWrap'
      | 'justifyContent'
      | 'alignItems'
      | 'alignContent'
      | 'statusBarStyle'
      | 'visibility'
      | 'opacity'
      | 'rotate'
      | 'rotateX'
      | 'rotateY'
      | 'scaleX'
      | 'scaleY'
      | 'androidElevation'
      | 'boxShadow'
      | 'clipPath'
      | 'itemWidth'
      | 'itemHeight',
  ): Apply =>
  (view, value) => {
    ;(view.style as unknown as Record<string, unknown>)[name] = value
  }

const setStyleLength =
  (
    name:
      | 'padding'
      | 'paddingTop'
      | 'paddingRight'
      | 'paddingBottom'
      | 'paddingLeft'
      | 'margin'
      | 'marginTop'
      | 'marginRight'
      | 'marginBottom'
      | 'marginLeft'
      | 'borderWidth'
      | 'borderTopWidth'
      | 'borderRightWidth'
      | 'borderBottomWidth'
      | 'borderLeftWidth'
      | 'borderRadius'
      | 'translateX'
      | 'translateY',
  ): Apply =>
  (view, value) => {
    ;(view.style as unknown as Record<string, unknown>)[name] = lengthOf(value)
  }

const setStyleColor =
  (
    name:
      | 'borderColor'
      | 'borderTopColor'
      | 'borderRightColor'
      | 'borderBottomColor'
      | 'borderLeftColor',
  ): Apply =>
  (view, value) => {
    ;(view.style as unknown as Record<string, unknown>)[name] = colorOf(value)
  }

const setView =
  (name: string): Apply =>
  (view, value) => {
    ;(view as unknown as Record<string, unknown>)[name] = value
  }

const setText =
  (name: 'text' | 'hint' | 'html'): Apply =>
  (view, value) => {
    ;(view as unknown as Record<string, unknown>)[name] = value ?? ''
  }

const setBool =
  (name: string): Apply =>
  (view, value) => {
    ;(view as unknown as Record<string, unknown>)[name] = Boolean(value)
  }

const setGridCell =
  (setter: (view: View, value: number) => void): Apply =>
  (view, value) => {
    setter(view, Number(value ?? 0))
  }

type TextSpan = Readonly<{
  text?: string
  color?: string
  backgroundColor?: string
  fontSize?: number
  fontWeight?: string
  fontStyle?: string
  fontFamily?: string
  textDecoration?: string
}>

const formattedFrom = (spans: ReadonlyArray<TextSpan>): FormattedString => {
  const formatted = new FormattedString()
  for (const entry of spans) {
    const span = new Span()
    span.text = entry.text ?? ''
    if (entry.color !== undefined) span.color = new Color(entry.color)
    if (entry.backgroundColor !== undefined) span.backgroundColor = new Color(entry.backgroundColor)
    if (entry.fontSize !== undefined) span.fontSize = entry.fontSize
    if (entry.fontWeight !== undefined) span.fontWeight = entry.fontWeight as never
    if (entry.fontStyle !== undefined) span.fontStyle = entry.fontStyle as never
    if (entry.fontFamily !== undefined) span.fontFamily = entry.fontFamily
    if (entry.textDecoration !== undefined) span.textDecoration = entry.textDecoration as never
    formatted.spans.push(span)
  }
  return formatted
}

const ACCESSIBILITY_PROPS: ReadonlyArray<string> = [
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityValue',
  'accessibilityRole',
  'accessibilityState',
  'accessible',
  'automationText',
]

const SHARED_PROPS: Readonly<Record<string, Apply>> = {
  isEnabled: setView('isEnabled'),
  isUserInteractionEnabled: setView('isUserInteractionEnabled'),
  visibility: (view, value) => {
    view.style.visibility = (value === 'collapsed' ? 'collapse' : (value ?? 'visible')) as never
  },
  opacity: setStyleValue('opacity'),
  backgroundColor: setStyle('backgroundColor'),
  color: setStyle('color'),
  tintColor: setStyle('tintColor'),
  fontSize: setStyleValue('fontSize'),
  fontWeight: setStyleValue('fontWeight'),
  fontStyle: setStyleValue('fontStyle'),
  fontFamily: setStyleValue('fontFamily'),
  textAlignment: setStyleValue('textAlignment'),
  letterSpacing: setStyleValue('letterSpacing'),
  lineHeight: setStyleValue('lineHeight'),
  textDecoration: setStyleValue('textDecoration'),
  textTransform: setStyleValue('textTransform'),
  whiteSpace: setStyleValue('whiteSpace'),
  maxLines: setStyleValue('maxLines'),
  padding: setStyleLength('padding'),
  paddingTop: setStyleLength('paddingTop'),
  paddingRight: setStyleLength('paddingRight'),
  paddingBottom: setStyleLength('paddingBottom'),
  paddingLeft: setStyleLength('paddingLeft'),
  margin: setStyleLength('margin'),
  marginTop: setStyleLength('marginTop'),
  marginRight: setStyleLength('marginRight'),
  marginBottom: setStyleLength('marginBottom'),
  marginLeft: setStyleLength('marginLeft'),
  borderWidth: setStyleLength('borderWidth'),
  borderTopWidth: setStyleLength('borderTopWidth'),
  borderRightWidth: setStyleLength('borderRightWidth'),
  borderBottomWidth: setStyleLength('borderBottomWidth'),
  borderLeftWidth: setStyleLength('borderLeftWidth'),
  borderColor: setStyleColor('borderColor'),
  borderTopColor: setStyleColor('borderTopColor'),
  borderRightColor: setStyleColor('borderRightColor'),
  borderBottomColor: setStyleColor('borderBottomColor'),
  borderLeftColor: setStyleColor('borderLeftColor'),
  borderRadius: setStyleLength('borderRadius'),
  cornerRadius: setStyleLength('borderRadius'),
  width: setView('width'),
  height: setView('height'),
  minWidth: setView('minWidth'),
  minHeight: setView('minHeight'),
  minimumWidth: setView('minWidth'),
  minimumHeight: setView('minHeight'),
  horizontalAlignment: setView('horizontalAlignment'),
  verticalAlignment: setView('verticalAlignment'),
  translateX: setStyleLength('translateX'),
  translateY: setStyleLength('translateY'),
  scaleX: setStyleValue('scaleX'),
  scaleY: setStyleValue('scaleY'),
  rotate: setStyleValue('rotate'),
  rotateX: setStyleValue('rotateX'),
  rotateY: setStyleValue('rotateY'),
  androidElevation: setStyleValue('androidElevation'),
  boxShadow: setStyleValue('boxShadow'),
  clipPath: setStyleValue('clipPath'),
  className: setView('className'),
  row: setGridCell((v, n) => GridLayout.setRow(v, n)),
  col: setGridCell((v, n) => GridLayout.setColumn(v, n)),
  rowSpan: setGridCell((v, n) => GridLayout.setRowSpan(v, n)),
  colSpan: setGridCell((v, n) => GridLayout.setColumnSpan(v, n)),
  dock: (view, value) => DockLayout.setDock(view, value as never),
  left: (view, value) => AbsoluteLayout.setLeft(view, lengthOf(value) as never),
  top: (view, value) => AbsoluteLayout.setTop(view, lengthOf(value) as never),
  flexGrow: (view, value) => FlexboxLayout.setFlexGrow(view, Number(value ?? 0)),
  flexShrink: (view, value) => FlexboxLayout.setFlexShrink(view, Number(value ?? 1)),
  order: (view, value) => FlexboxLayout.setOrder(view, Number(value ?? 1)),
  flexWrapBefore: (view, value) => FlexboxLayout.setFlexWrapBefore(view, Boolean(value)),
  alignSelf: setStyleValue('alignSelf'),
  accessible: setView('accessible'),
  accessibilityLabel: setView('accessibilityLabel'),
  accessibilityHint: setView('accessibilityHint'),
  accessibilityValue: setView('accessibilityValue'),
  accessibilityRole: setView('accessibilityRole'),
  accessibilityState: setView('accessibilityState'),
  automationText: setView('automationText'),
}

const TEXT_ENTRY_PROPS: Readonly<Record<string, Apply>> = {
  text: setText('text'),
  hint: setText('hint'),
  keyboardType: setView('keyboardType'),
  returnKeyType: setView('returnKeyType'),
  autocapitalizationType: setView('autocapitalizationType'),
  autocorrect: setBool('autocorrect'),
  maxLength: setView('maxLength'),
  editable: setBool('editable'),
  placeholderColor: setStyle('placeholderColor'),
}

const KIND_PROPS: Readonly<Record<NativeElementKind, Readonly<Record<string, Apply>>>> = {
  Page: {
    title: (view, value) => {
      ;(view as Page).actionBar.title = value === undefined || value === null ? '' : String(value)
    },
    actionBarHidden: setBool('actionBarHidden'),
    backgroundSpanUnderStatusBar: setBool('backgroundSpanUnderStatusBar'),
    statusBarStyle: setStyleValue('statusBarStyle'),
    enableSwipeBackNavigation: setBool('enableSwipeBackNavigation'),
  },
  Stack: { orientation: setView('orientation') },
  Grid: { rows: setView('rows'), columns: setView('columns') },
  Flexbox: {
    flexDirection: setStyleValue('flexDirection'),
    flexWrap: setStyleValue('flexWrap'),
    justifyContent: setStyleValue('justifyContent'),
    alignItems: setStyleValue('alignItems'),
    alignContent: setStyleValue('alignContent'),
  },
  Wrap: {
    orientation: setView('orientation'),
    itemWidth: setView('itemWidth'),
    itemHeight: setView('itemHeight'),
  },
  Absolute: {},
  Dock: { stretchLastChild: setBool('stretchLastChild') },
  Scroll: {
    orientation: setView('orientation'),
    scrollBarIndicatorVisible: setBool('scrollBarIndicatorVisible'),
  },
  Text: {
    text: setText('text'),
    textWrap: setBool('textWrap'),
    spans: (view, value) => {
      ;(view as Label).formattedText = (
        value === undefined || value === null
          ? undefined
          : formattedFrom(value as ReadonlyArray<TextSpan>)
      ) as never
    },
  },
  Button: { text: setText('text'), textWrap: setBool('textWrap') },
  TextField: {
    ...TEXT_ENTRY_PROPS,
    secure: setBool('secure'),
  },
  TextView: {
    ...TEXT_ENTRY_PROPS,
  },
  SearchBar: {
    text: setText('text'),
    hint: setText('hint'),
    textFieldBackgroundColor: (view, value) => {
      ;(view as SearchBar).textFieldBackgroundColor = colorOf(value) as never
    },
    textFieldHintColor: (view, value) => {
      ;(view as SearchBar).textFieldHintColor = colorOf(value) as never
    },
  },
  Switch: { checked: setBool('checked') },
  Slider: {
    value: setView('value'),
    minValue: setView('minValue'),
    maxValue: setView('maxValue'),
  },
  Progress: {
    value: setView('value'),
    maxValue: setView('maxValue'),
  },
  ActivityIndicator: { busy: setBool('busy') },
  Image: {
    src: setView('src'),
    stretch: setView('stretch'),
    loadMode: setView('loadMode'),
    decodeWidth: setView('decodeWidth'),
    decodeHeight: setView('decodeHeight'),
  },
  List: {
    items: (view, value) => {
      const items = (value as ReadonlyArray<unknown> | undefined) ?? []
      ;(view as ListView).items = items.map((item) =>
        typeof item === 'object' && item !== null ? item : { text: String(item) },
      )
    },
    separatorColor: (view, value) => {
      ;(view as ListView).separatorColor = colorOf(value) as never
    },
  },
  ListPicker: {
    items: (view, value) => {
      ;(view as ListPicker).items = (value as ReadonlyArray<unknown> | undefined)?.map(String) ?? []
    },
    selectedIndex: setView('selectedIndex'),
  },
  SegmentedBar: {
    items: (view, value) => {
      const items = (value as ReadonlyArray<unknown> | undefined) ?? []
      ;(view as SegmentedBar).items = items.map((item) => {
        const entry = new SegmentedBarItem()
        entry.title =
          typeof item === 'object' && item !== null
            ? String((item as { title?: unknown }).title ?? '')
            : String(item)
        return entry
      })
    },
    selectedIndex: setView('selectedIndex'),
    selectedBackgroundColor: (view, value) => {
      ;(view as SegmentedBar).selectedBackgroundColor = colorOf(value) as never
    },
  },
  HtmlView: { html: setText('html') },
}

const KIND_FACTORIES: Readonly<Record<NativeElementKind, () => View>> = {
  Page: () => new Page(),
  Stack: () => new StackLayout(),
  Grid: () => new GridLayout(),
  Flexbox: () => new FlexboxLayout(),
  Wrap: () => new WrapLayout(),
  Absolute: () => new AbsoluteLayout(),
  Dock: () => new DockLayout(),
  Scroll: () => new ScrollView(),
  Text: () => new Label(),
  Button: () => new Button(),
  TextField: () => new TextField(),
  TextView: () => new TextView(),
  SearchBar: () => new SearchBar(),
  Switch: () => new Switch(),
  Slider: () => new Slider(),
  Progress: () => new Progress(),
  ActivityIndicator: () => new ActivityIndicator(),
  Image: () => new Image(),
  List: () => {
    const list = new ListView()
    const label = () => {
      const row = new Label()
      row.bind({ sourceProperty: 'text', targetProperty: 'text' })
      return row
    }
    list.itemTemplate = label
    return list
  },
  ListPicker: () => new ListPicker(),
  SegmentedBar: () => new SegmentedBar(),
  HtmlView: () => new HtmlView(),
}

const SUPPORTED = new Map<NativeElementKind, ReadonlySet<string>>(
  (Object.keys(KIND_PROPS) as Array<NativeElementKind>).map((kind) => [
    kind,
    new Set([
      ...Object.keys(SHARED_PROPS),
      ...Object.keys(KIND_PROPS[kind]),
      'spacing',
      ...ACCESSIBILITY_PROPS,
    ]),
  ]),
)

const SPACING_AXIS = new WeakMap<View, 'vertical' | 'horizontal'>()
const AUTO_MARGIN = new WeakMap<View, { top: number; left: number }>()

const containerAxis = (view: View): 'vertical' | 'horizontal' | undefined => {
  if (view instanceof StackLayout)
    return view.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  if (view instanceof WrapLayout)
    return view.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  if (view instanceof ScrollView)
    return view.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  if (view instanceof FlexboxLayout) {
    const direction = view.style.flexDirection ?? 'row'
    return direction === 'row' || direction === 'row-reverse' ? 'horizontal' : 'vertical'
  }
  if (view instanceof GridLayout) return 'vertical'
  return undefined
}

const applySpacing = (container: View): void => {
  const spacing = spacingValues.get(container)
  if (spacing === undefined || !(container instanceof LayoutBase)) return
  const axis = SPACING_AXIS.get(container) ?? 'vertical'
  const count = container.getChildrenCount()
  for (let index = 0; index < count; index += 1) {
    const child = container.getChildAt(index)
    const auto = AUTO_MARGIN.get(child) ?? { top: 0, left: 0 }
    const next = { top: 0, left: 0 }
    if (index > 0) {
      if (axis === 'vertical') next.top = spacing
      else next.left = spacing
    }
    if (child.style.marginTop === auto.top && child.style.marginLeft === auto.left) {
      child.style.marginTop = next.top
      child.style.marginLeft = next.left
    }
    AUTO_MARGIN.set(child, next)
  }
}

const spacingValues = new WeakMap<View, number>()

const KIND_OF = new WeakMap<View, NativeElementKind>()

const applyProp = (view: View, name: string, value: unknown): void => {
  if (name === 'spacing') {
    spacingValues.set(view, Number(value ?? 0))
    SPACING_AXIS.set(view, containerAxis(view) ?? 'vertical')
    applySpacing(view)
    return
  }
  const shared = SHARED_PROPS[name]
  if (shared !== undefined) {
    shared(view, value)
    return
  }
  throw new Error(`unknown property ${JSON.stringify(name)}`)
}

const setProperty = (view: View, name: string, value: unknown): void => {
  const kind = KIND_OF.get(view)
  if (kind !== undefined) {
    const apply = KIND_PROPS[kind][name]
    if (apply !== undefined) {
      apply(view, value)
      return
    }
  }
  applyProp(view, name, value)
}

const KNOWN_EVENTS: ReadonlyArray<string> = [
  'tap',
  'doubleTap',
  'longPress',
  'swipe',
  'pan',
  'pinch',
  'rotation',
  'touch',
  'textChange',
  'valueChange',
  'checkedChange',
  'selectedIndexChanged',
  'selectedIndexChange',
  'itemTap',
  'itemLoading',
  'submit',
  'clear',
  'scroll',
  'focus',
  'blur',
  'loadStarted',
  'loadFinished',
  'isLoadingChange',
  'dateChange',
  'timeChange',
]

const isFocused = (view: View): boolean => {
  const android = (view as { android?: { hasFocus?: () => boolean } }).android
  if (android !== undefined) return android.hasFocus?.() === true
  const ios = (view as { ios?: { isFirstResponder?: boolean } }).ios
  return ios?.isFirstResponder === true
}

const insertChild = (parent: View, child: View, index: number): void => {
  if (parent instanceof Page || parent instanceof ScrollView || parent instanceof ContentView) {
    ;(parent as ContentView).content = child
    return
  }
  if (parent instanceof LayoutBase) {
    const current = parent.getChildIndex(child)
    if (current !== index) {
      if (current >= 0) parent.removeChild(child)
      parent.insertChild(child, index)
    }
    applySpacing(parent)
    return
  }
  throw new Error(`${parent.constructor.name} cannot contain children`)
}

const removeChild = (parent: View, child: View): void => {
  if (parent instanceof LayoutBase) {
    parent.removeChild(child)
    applySpacing(parent)
    return
  }
  if (parent instanceof Page || parent instanceof ScrollView || parent instanceof ContentView) {
    if ((parent as ContentView).content === child) {
      ;(parent as ContentView).content = undefined as never
    }
    return
  }
  throw new Error(`${parent.constructor.name} cannot contain children`)
}

const captureLocalState = (view: View): RendererLocalState => {
  const state: { focused?: boolean; scrollOffset?: number } = {}
  if (isFocused(view)) state.focused = true
  if (view instanceof ScrollView) {
    state.scrollOffset =
      view.orientation === 'horizontal' ? view.horizontalOffset : view.verticalOffset
  }
  return state
}

const restoreLocalState = (view: View, state: RendererLocalState): void => {
  if (state.focused === true && !isFocused(view)) {
    view.focus()
  }
  if (view instanceof ScrollView && state.scrollOffset !== undefined && state.scrollOffset > 0) {
    const offset = state.scrollOffset
    setTimeout(() => {
      if (view.orientation === 'horizontal') view.scrollToHorizontalOffset(offset, false)
      else view.scrollToVerticalOffset(offset, false)
    }, 0)
  }
}

export const createNativeScriptHost = (): NativeHost<View> => ({
  create: (kind) => {
    const view = KIND_FACTORIES[kind]()
    KIND_OF.set(view, kind)
    return view
  },
  setProperty,
  supportedProperties: (kind) => SUPPORTED.get(kind) ?? new Set(Object.keys(SHARED_PROPS)),
  addEventListener: (view, name, listener) => view.on(name, listener),
  removeEventListener: (view, name, listener) => view.off(name, listener),
  insertChild,
  removeChild,
  captureLocalState,
  restoreLocalState,
  dispose: (view) => {
    for (const event of KNOWN_EVENTS) view.off(event)
  },
})
