import * as PIXI from 'pixi.js'
import { Creature } from './creature.js'
import { Scaffolding } from './buildings/scaffolding.js'

const TAB_BUILDINGS = 'buildings'
const TAB_ASSIGNMENTS = 'assignments'

export class Menu {

    constructor(app, game, container) {
        this.app = app
        this.game = game
        this.container = container
        this.selectedObject = null
        this.activeTab = TAB_BUILDINGS
        this.panelOpen = false
        this.hoveredBuildOption = null
        this.selectedBuildOption = null
        this.buildPreview = null
        this.buildGrid = null
        this.buildGridScroll = 0
        this.assignmentFilter = 'miner'
        this.assignmentActiveScroll = 0
        this.assignmentUnassignedScroll = 0
        this.scrollAreas = []

        this.root = new PIXI.Container()
        this.root.sortableChildren = true
        this.root.zIndex = 50
        this.container.addChild(this.root)

        this.textStyles = {
            title: new PIXI.TextStyle({
                fontFamily: 'Trebuchet MS',
                fontSize: 28,
                fontWeight: 'bold',
                fill: '#eef8ff'
            }),
            subtitle: new PIXI.TextStyle({
                fontFamily: 'Verdana',
                fontSize: 14,
                fill: '#8db7c7'
            }),
            sectionLabel: new PIXI.TextStyle({
                fontFamily: 'Trebuchet MS',
                fontSize: 13,
                fontWeight: 'bold',
                fill: '#9fc3d2'
            }),
            body: new PIXI.TextStyle({
                fontFamily: 'Verdana',
                fontSize: 14,
                fill: '#e2eef4',
                lineHeight: 20
            }),
            bodySmall: new PIXI.TextStyle({
                fontFamily: 'Verdana',
                fontSize: 13,
                fill: '#d2e4ec',
                lineHeight: 18
            }),
            meta: new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 13,
                fill: '#87adbb'
            }),
            buttonLight: new PIXI.TextStyle({
                fontFamily: 'Trebuchet MS',
                fontSize: 15,
                fontWeight: 'bold',
                fill: '#0a1722'
            }),
            buttonDark: new PIXI.TextStyle({
                fontFamily: 'Trebuchet MS',
                fontSize: 15,
                fontWeight: 'bold',
                fill: '#eaf6fd'
            }),
            tabActive: new PIXI.TextStyle({
                fontFamily: 'Trebuchet MS',
                fontSize: 15,
                fontWeight: 'bold',
                fill: '#edf8ff'
            }),
            tabInactive: new PIXI.TextStyle({
                fontFamily: 'Trebuchet MS',
                fontSize: 15,
                fontWeight: 'bold',
                fill: '#95b7c6'
            })
        }

        this.refresh()
    }

    getLayoutMetrics() {
        const screenPadding = 16
        const buttonWidth = 132
        const buttonHeight = 44
        const panelWidth = Math.max(460, Math.min(560, Math.floor(this.app.screen.width * 0.36)))
        const panelHeight = this.app.screen.height

        return {
            screenPadding,
            buttonWidth,
            buttonHeight,
            buttonX: this.app.screen.width - buttonWidth - screenPadding,
            buttonY: screenPadding,
            panelWidth,
            panelHeight,
            panelX: this.app.screen.width - panelWidth,
            panelY: 0,
            contentPadding: 18,
            tabHeight: 42
        }
    }

    getPanelWidth() {
        return this.getLayoutMetrics().panelWidth
    }

    getOpenPanelWidth() {
        return this.panelOpen ? this.getPanelWidth() : 0
    }

    getOccludedLeftEdge() {
        const metrics = this.getLayoutMetrics()
        return this.panelOpen ? metrics.panelX : metrics.buttonX
    }

    coversScreenPoint(position) {
        if (!position) {
            return false
        }

        const metrics = this.getLayoutMetrics()
        if (!this.panelOpen) {
            const insideOpenButton = (
                position.x >= metrics.buttonX &&
                position.x <= (metrics.buttonX + metrics.buttonWidth) &&
                position.y >= metrics.buttonY &&
                position.y <= (metrics.buttonY + metrics.buttonHeight)
            )

            if (insideOpenButton) {
                return true
            }
        }

        return this.panelOpen && (
            position.x >= metrics.panelX &&
            position.x <= (metrics.panelX + metrics.panelWidth) &&
            position.y >= metrics.panelY &&
            position.y <= (metrics.panelY + metrics.panelHeight)
        )
    }

    isOpen() {
        return this.panelOpen
    }

    open() {
        return this.openPanel()
    }

    close() {
        return this.closePanel()
    }

    openPanel({ tab = null } = {}) {
        if (tab === TAB_BUILDINGS || tab === TAB_ASSIGNMENTS) {
            this.activeTab = tab
        }

        this.panelOpen = true
        this.refresh()
        return true
    }

    closePanel() {
        this.panelOpen = false
        this.refresh()
        return true
    }

    togglePanel({ tab = null } = {}) {
        if (this.panelOpen) {
            return this.closePanel()
        }

        return this.openPanel({ tab })
    }

    setSelectedObject(object) {
        this.selectedObject = object ?? null
        this.refresh()
        return true
    }

    handleWheel(event) {
        if (!this.panelOpen || !event) {
            return false
        }

        const rect = this.app.canvas.getBoundingClientRect()
        const position = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        }

        if (!this.coversScreenPoint(position)) {
            return false
        }

        const delta = Math.max(-90, Math.min(90, event.deltaY))
        for (const area of this.scrollAreas) {
            const viewport = area.viewport
            const isInsideArea = (
                position.x >= viewport.x &&
                position.x <= (viewport.x + viewport.width) &&
                position.y >= viewport.y &&
                position.y <= (viewport.y + viewport.height)
            )

            if (!isInsideArea) {
                continue
            }

            if (area.maxScroll > 0) {
                this.setScrollAreaScroll(area, area.scroll + delta)
            }
            return true
        }

        return true
    }

    clearContainer(container) {
        for (const child of [...container.children]) {
            container.removeChild(child)
            child.destroy({ children: true })
        }
    }

    drawRoundedRect(graphics, width, height, {
        fillColor,
        fillAlpha = 1,
        borderColor = 0x000000,
        borderAlpha = 1,
        borderWidth = 0,
        radius = 18
    }) {
        graphics.clear()
        graphics.roundRect(0, 0, width, height, radius)
        graphics.fill({ color: fillColor, alpha: fillAlpha })

        if (borderWidth > 0) {
            graphics.roundRect(0, 0, width, height, radius)
            graphics.stroke({
                color: borderColor,
                alpha: borderAlpha,
                width: borderWidth
            })
        }

        return graphics
    }

    getButtonPalette(variant, state = 'default') {
        const palettes = {
            toggle: {
                default: { fillColor: 0xcbb07a, borderColor: 0xf5e3b8, textStyle: this.textStyles.buttonLight },
                hover: { fillColor: 0xd9bf8a, borderColor: 0xffe9bd, textStyle: this.textStyles.buttonLight },
                pressed: { fillColor: 0xb89b67, borderColor: 0xe9d6aa, textStyle: this.textStyles.buttonLight }
            },
            tabActive: {
                default: { fillColor: 0x214b5f, borderColor: 0x8ccfe0, textStyle: this.textStyles.tabActive },
                hover: { fillColor: 0x27566d, borderColor: 0xa0dded, textStyle: this.textStyles.tabActive },
                pressed: { fillColor: 0x1a3d4e, borderColor: 0x79bfd2, textStyle: this.textStyles.tabActive }
            },
            tabInactive: {
                default: { fillColor: 0x0d2130, borderColor: 0x35586a, textStyle: this.textStyles.tabInactive },
                hover: { fillColor: 0x143044, borderColor: 0x4c7488, textStyle: this.textStyles.tabInactive },
                pressed: { fillColor: 0x102838, borderColor: 0x426578, textStyle: this.textStyles.tabInactive }
            },
            primary: {
                default: { fillColor: 0x7dbda9, borderColor: 0xc9f5e7, textStyle: this.textStyles.buttonLight },
                hover: { fillColor: 0x90d0bb, borderColor: 0xdbfff4, textStyle: this.textStyles.buttonLight },
                pressed: { fillColor: 0x6aa792, borderColor: 0xb2e6d6, textStyle: this.textStyles.buttonLight }
            },
            secondary: {
                default: { fillColor: 0x183549, borderColor: 0x6ea3b8, textStyle: this.textStyles.buttonDark },
                hover: { fillColor: 0x21465d, borderColor: 0x88bfd2, textStyle: this.textStyles.buttonDark },
                pressed: { fillColor: 0x123041, borderColor: 0x5e93a8, textStyle: this.textStyles.buttonDark }
            },
            card: {
                default: { fillColor: 0x102636, borderColor: 0x36586b, textStyle: this.textStyles.buttonDark },
                hover: { fillColor: 0x163247, borderColor: 0x7db3c4, textStyle: this.textStyles.buttonDark },
                pressed: { fillColor: 0x102b3b, borderColor: 0x6799ab, textStyle: this.textStyles.buttonDark }
            }
        }

        return palettes[variant]?.[state] ?? palettes.secondary.default
    }

    createButton({
        label,
        x,
        y,
        width,
        height,
        variant = 'secondary',
        onClick = null
    }) {
        const button = new PIXI.Container()
        button.x = x
        button.y = y
        button.eventMode = 'static'
        button.cursor = 'pointer'

        const background = new PIXI.Graphics()
        const labelText = new PIXI.Text({
            text: label,
            style: this.getButtonPalette(variant).textStyle
        })
        labelText.anchor.set(0.5)
        labelText.x = width / 2
        labelText.y = height / 2

        const redraw = (state = 'default') => {
            const palette = this.getButtonPalette(variant, state)
            this.drawRoundedRect(background, width, height, {
                fillColor: palette.fillColor,
                borderColor: palette.borderColor,
                borderAlpha: 1,
                borderWidth: 2,
                radius: 14
            })
            labelText.style = palette.textStyle
        }

        redraw()

        button.on('pointerover', () => redraw('hover'))
        button.on('pointerout', () => redraw('default'))
        button.on('pointerdown', () => redraw('pressed'))
        button.on('pointerup', () => {
            redraw('hover')
            if (typeof onClick === 'function') {
                onClick()
            }
        })
        button.on('pointerupoutside', () => redraw('default'))

        button.addChild(background)
        button.addChild(labelText)
        return button
    }

    createBodyText(text, wordWrapWidth, style = this.textStyles.bodySmall) {
        return new PIXI.Text({
            text,
            style: new PIXI.TextStyle({
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                fill: style.fill,
                lineHeight: style.lineHeight,
                wordWrap: true,
                wordWrapWidth
            })
        })
    }

    createFittedText(text, maxWidth, {
        maxFontSize = 15,
        minFontSize = 9,
        fill = '#eaf6fd',
        fontFamily = 'Trebuchet MS',
        fontWeight = 'bold'
    } = {}) {
        const baseStyle = {
            fontFamily,
            fontWeight,
            fill,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: maxWidth
        }

        let fontSize = maxFontSize
        const label = new PIXI.Text({
            text,
            style: new PIXI.TextStyle({
                ...baseStyle,
                fontSize
            })
        })

        while (fontSize > minFontSize && (label.width > maxWidth || label.height > (fontSize * 2.5))) {
            fontSize -= 1
            label.style = new PIXI.TextStyle({
                ...baseStyle,
                fontSize
            })
        }

        return label
    }

    createScaledSprite(texture, maxWidth, maxHeight) {
        const sprite = new PIXI.Sprite(texture ?? PIXI.Texture.EMPTY)
        const safeWidth = Math.max(sprite.width, 1)
        const safeHeight = Math.max(sprite.height, 1)
        const scale = Math.min(maxWidth / safeWidth, maxHeight / safeHeight)
        sprite.anchor.set(0.5)
        sprite.scale.set(scale)
        return sprite
    }

    getFactoryKey(factory) {
        return factory?.name ?? null
    }

    syncBuildOptionSelection(buildableOptions) {
        const hasFactory = (candidate) => {
            const candidateKey = this.getFactoryKey(candidate)
            if (!candidateKey) {
                return false
            }

            return buildableOptions.some((option) => this.getFactoryKey(option) === candidateKey)
        }

        if (!hasFactory(this.selectedBuildOption)) {
            this.selectedBuildOption = buildableOptions[0] ?? null
        }

        if (!hasFactory(this.hoveredBuildOption)) {
            this.hoveredBuildOption = null
        }
    }

    getActiveBuildPreviewOption() {
        return this.hoveredBuildOption ?? this.selectedBuildOption ?? null
    }

    updateBuildPreview() {
        if (!this.buildPreview) {
            return false
        }

        const activeFactory = this.getActiveBuildPreviewOption()
        const {
            title,
            size,
            description,
            imageContainer,
            placeholder,
            imageFrameWidth,
            imageFrameHeight
        } = this.buildPreview

        for (const child of [...imageContainer.children]) {
            imageContainer.removeChild(child)
            child.destroy({ children: true })
        }

        if (!activeFactory) {
            title.text = 'No Building Selected'
            size.text = ''
            description.text = 'Hover over a building card or click one to keep it selected here.'
            placeholder.text = 'Choose a building below'
            placeholder.visible = true
            return false
        }

        title.text = activeFactory.name
        size.text = `Size: ${activeFactory.size.x} x ${activeFactory.size.y}`
        description.text = activeFactory.description || 'No description yet.'
        placeholder.visible = false

        const previewSprite = this.createScaledSprite(
            activeFactory.sprite?.texture,
            imageFrameWidth - 18,
            imageFrameHeight - 12
        )
        previewSprite.x = imageFrameWidth / 2
        previewSprite.y = imageFrameHeight / 2
        imageContainer.addChild(previewSprite)
        return true
    }

    setBuildGridScroll(nextScroll) {
        if (!this.buildGrid) {
            this.buildGridScroll = Math.max(0, nextScroll ?? 0)
            return this.buildGridScroll
        }

        return this.setScrollAreaScroll(this.buildGrid, nextScroll)
    }

    setScrollAreaScroll(area, nextScroll) {
        if (!area) {
            return 0
        }

        const clamped = Math.max(0, Math.min(area.maxScroll ?? 0, nextScroll ?? 0))
        area.scroll = clamped
        area.content.y = area.viewport.y - clamped

        if (typeof area.scrollKey === 'string') {
            this[area.scrollKey] = clamped
        }

        if (area.scrollbarThumb) {
            const ratio = (area.maxScroll ?? 0) > 0 ? (clamped / area.maxScroll) : 0
            const travel = Math.max(0, (area.scrollbarTrackHeight ?? 0) - (area.scrollbarThumbHeight ?? 0))
            area.scrollbarThumb.x = area.scrollbarX
            area.scrollbarThumb.y = area.viewport.y + (ratio * travel)
        }

        return clamped
    }

    registerScrollArea(area) {
        if (!area) {
            return null
        }

        const scrollArea = {
            ...area,
            scroll: 0
        }
        this.scrollAreas.push(scrollArea)
        const initialScroll = typeof scrollArea.scrollKey === 'string'
            ? (this[scrollArea.scrollKey] ?? 0)
            : 0
        this.setScrollAreaScroll(scrollArea, initialScroll)
        return scrollArea
    }

    getBuildableOptions() {
        if (this.selectedObject instanceof Creature && typeof this.selectedObject.getBuildable === 'function') {
            const selectedBuildables = this.selectedObject.getBuildable()
            if (Array.isArray(selectedBuildables) && selectedBuildables.length > 0) {
                return selectedBuildables
            }
        }

        return [...this.game.unlockedBuildings]
    }

    getManagedTrilobites() {
        const trilobites = this.game.cave?.trilobites
        if (!(trilobites instanceof Set)) {
            return []
        }

        return [...trilobites]
            .filter((creature) => creature?.assignment !== 'enemy')
            .sort((a, b) => (a?.name ?? '').localeCompare(b?.name ?? ''))
    }

    getCreaturesForAssignment(assignment) {
        return this.getManagedTrilobites().filter((creature) => creature?.assignment === assignment)
    }

    buildAssignmentEntries(creatures) {
        if (!Array.isArray(creatures) || creatures.length === 0) {
            return []
        }

        return [{
            count: creatures.length,
            texture: creatures[0]?.sprite?.texture ?? PIXI.Texture.from('Trilobite'),
            creatures
        }]
    }

    applyCreatureAssignment(creature, assignment, { clearActive = false } = {}) {
        if (!(creature instanceof Creature)) {
            return false
        }

        creature.assignment = assignment
        creature.clearActionQueue()

        const behavior = creature.getBehavior?.()
        if (typeof behavior === 'function') {
            behavior.call(creature)
        }

        if (clearActive) {
            this.game.cleanActive()
        }

        return true
    }

    transferCreatureAssignment(fromAssignment, toAssignment) {
        const sourceCreatures = this.getCreaturesForAssignment(fromAssignment)
        if (sourceCreatures.length === 0) {
            return false
        }

        const creature = sourceCreatures[0]
        if (!this.applyCreatureAssignment(creature, toAssignment)) {
            return false
        }

        this.refresh()
        return true
    }

    startBuildingPlacement(factory, event = null) {
        if (!factory || typeof factory.build !== 'function') {
            return false
        }

        this.selectedBuildOption = factory
        this.updateBuildPreview()

        if (this.game.floatingBuilding.sprite) {
            this.game.clearFloatingBuilding({ destroySprite: true })
        }

        this.game.movePath = false

        const pointer = event?.data?.global
        const position = pointer
            ? { x: pointer.x, y: pointer.y }
            : { x: this.app.screen.width / 2, y: this.app.screen.height / 2 }

        try {
            const targetBuilding = factory.build()
            const scaffolding = new Scaffolding(this.game, targetBuilding)
            return this.game.beginBuildingPlacement(scaffolding, position, targetBuilding.sprite)
        } catch (error) {
            console.error(error)
            return false
        }
    }

    renderToggleButton(metrics) {
        const toggleButton = this.createButton({
            label: 'Menu',
            x: metrics.buttonX,
            y: metrics.buttonY,
            width: metrics.buttonWidth,
            height: metrics.buttonHeight,
            variant: 'toggle',
            onClick: () => this.openPanel()
        })

        this.root.addChild(toggleButton)
    }

    renderTabs(panel, metrics) {
        const tabs = [
            { key: TAB_BUILDINGS, label: 'Buildings' },
            { key: TAB_ASSIGNMENTS, label: 'Assignments' }
        ]
        const tabGap = 12
        const tabWidth = Math.min(200, ((metrics.panelWidth - (metrics.contentPadding * 2)) - tabGap) / 2)
        let tabX = metrics.contentPadding

        for (const tab of tabs) {
            const isActive = tab.key === this.activeTab
            const tabButton = this.createButton({
                label: tab.label,
                x: tabX,
                y: 70,
                width: tabWidth,
                height: metrics.tabHeight,
                variant: isActive ? 'tabActive' : 'tabInactive',
                onClick: () => {
                    this.activeTab = tab.key
                    this.refresh()
                }
            })

            panel.addChild(tabButton)
            tabX += tabWidth + tabGap
        }
    }

    renderBuildingsTab(panel, bounds) {
        const buildableOptions = this.getBuildableOptions()
        this.syncBuildOptionSelection(buildableOptions)

        const sectionGap = 16
        let previewHeight = Math.min(280, Math.max(190, Math.floor(bounds.height * 0.36)))
        let gridHeight = bounds.height - previewHeight - sectionGap

        if (gridHeight < 150) {
            previewHeight = Math.max(120, previewHeight - (150 - gridHeight))
            gridHeight = bounds.height - previewHeight - sectionGap
        }

        const previewBox = new PIXI.Graphics()
        this.drawRoundedRect(previewBox, bounds.width, previewHeight, {
            fillColor: 0x122534,
            fillAlpha: 1,
            borderColor: 0x4a7284,
            borderWidth: 2,
            borderAlpha: 1,
            radius: 18
        })
        previewBox.x = bounds.x
        previewBox.y = bounds.y
        panel.addChild(previewBox)

        const previewLabel = new PIXI.Text({
            text: 'BUILDING PREVIEW',
            style: this.textStyles.sectionLabel
        })
        previewLabel.x = bounds.x + 16
        previewLabel.y = bounds.y + 14
        panel.addChild(previewLabel)

        const previewTitle = new PIXI.Text({
            text: '',
            style: this.textStyles.body
        })
        previewTitle.x = bounds.x + 16
        previewTitle.y = bounds.y + 40
        panel.addChild(previewTitle)

        const previewSize = new PIXI.Text({
            text: '',
            style: this.textStyles.meta
        })
        previewSize.x = bounds.x + 16
        previewSize.y = bounds.y + 66
        panel.addChild(previewSize)

        const previewInnerPadding = 16
        const previewColumnGap = 18
        const previewTextWidth = Math.floor((bounds.width - (previewInnerPadding * 2) - previewColumnGap) / 2)
        const imageFrameWidth = bounds.width - (previewInnerPadding * 2) - previewColumnGap - previewTextWidth
        const imageFrameHeight = previewHeight - (previewInnerPadding * 2)
        const imageFrame = new PIXI.Graphics()
        this.drawRoundedRect(imageFrame, imageFrameWidth, imageFrameHeight, {
            fillColor: 0x08131d,
            fillAlpha: 0.95,
            borderColor: 0x385768,
            borderWidth: 2,
            borderAlpha: 1,
            radius: 14
        })
        imageFrame.x = bounds.x + previewInnerPadding + previewTextWidth + previewColumnGap
        imageFrame.y = bounds.y + previewInnerPadding
        panel.addChild(imageFrame)

        const imageContainer = new PIXI.Container()
        imageContainer.x = imageFrame.x
        imageContainer.y = imageFrame.y
        panel.addChild(imageContainer)

        const previewPlaceholder = new PIXI.Text({
            text: 'Choose a building below',
            style: this.textStyles.meta
        })
        previewPlaceholder.anchor.set(0.5)
        previewPlaceholder.x = imageFrame.x + (imageFrameWidth / 2)
        previewPlaceholder.y = imageFrame.y + (imageFrameHeight / 2)
        panel.addChild(previewPlaceholder)

        const previewDescription = this.createBodyText('', previewTextWidth)
        previewDescription.x = bounds.x + previewInnerPadding
        previewDescription.y = bounds.y + 104
        panel.addChild(previewDescription)

        this.buildPreview = {
            title: previewTitle,
            size: previewSize,
            description: previewDescription,
            imageContainer,
            placeholder: previewPlaceholder,
            imageFrameWidth,
            imageFrameHeight
        }
        this.updateBuildPreview()

        const gridFrameY = bounds.y + previewHeight + sectionGap
        const gridFrame = new PIXI.Graphics()
        this.drawRoundedRect(gridFrame, bounds.width, gridHeight, {
            fillColor: 0x0d1f2c,
            fillAlpha: 1,
            borderColor: 0x355466,
            borderWidth: 2,
            borderAlpha: 1,
            radius: 18
        })
        gridFrame.x = bounds.x
        gridFrame.y = gridFrameY
        panel.addChild(gridFrame)

        const gridLabel = new PIXI.Text({
            text: 'BUILDINGS',
            style: this.textStyles.sectionLabel
        })
        gridLabel.x = bounds.x + 16
        gridLabel.y = gridFrameY + 14
        panel.addChild(gridLabel)

        const gridIntro = this.createBodyText(
            'Scroll here with the mouse wheel. Hover a card to preview it, click to begin placement.',
            bounds.width - 32,
            this.textStyles.meta
        )
        gridIntro.x = bounds.x + 16
        gridIntro.y = gridFrameY + 34
        panel.addChild(gridIntro)

        const viewport = {
            x: bounds.x + 14,
            y: gridFrameY + 84,
            width: bounds.width - 28,
            height: Math.max(88, gridHeight - 98)
        }

        const gridMask = new PIXI.Graphics()
        this.drawRoundedRect(gridMask, viewport.width, viewport.height, {
            fillColor: 0xffffff,
            fillAlpha: 1,
            radius: 12
        })
        gridMask.x = viewport.x
        gridMask.y = viewport.y
        panel.addChild(gridMask)

        const gridContent = new PIXI.Container()
        gridContent.x = viewport.x
        gridContent.y = viewport.y
        gridContent.mask = gridMask
        panel.addChild(gridContent)

        if (buildableOptions.length === 0) {
            const emptyState = this.createBodyText(
                'No buildings are currently unlocked.',
                viewport.width
            )
            emptyState.x = 4
            emptyState.y = 4
            gridContent.addChild(emptyState)
            this.buildGrid = {
                viewport,
                content: gridContent,
                maxScroll: 0,
                scrollbarThumb: null,
                scrollbarTrackHeight: 0,
                scrollbarThumbHeight: 0,
                scrollbarX: 0,
                scrollKey: 'buildGridScroll'
            }
            this.buildGrid = this.registerScrollArea(this.buildGrid)
            return
        }

        const columns = 4
        const columnGap = 10
        const rowGap = 10
        const cardWidth = (viewport.width - (columnGap * (columns - 1)) - 10) / columns
        const cardHeight = 112
        const usableSpriteHeight = 58

        buildableOptions.forEach((factory, index) => {
            const column = index % columns
            const row = Math.floor(index / columns)
            const card = new PIXI.Container()
            card.x = (cardWidth + columnGap) * column
            card.y = (cardHeight + rowGap) * row
            card.eventMode = 'static'
            card.cursor = 'pointer'

            const background = new PIXI.Graphics()
            const redraw = (state = 'default') => {
                const isSelected = this.getFactoryKey(factory) === this.getFactoryKey(this.selectedBuildOption)
                const palette = this.getButtonPalette('card', state)
                const fillColor = isSelected && state === 'default' ? 0x1b4158 : palette.fillColor
                const borderColor = isSelected && state === 'default' ? 0xa3d9eb : palette.borderColor
                this.drawRoundedRect(background, cardWidth, cardHeight, {
                    fillColor,
                    fillAlpha: 1,
                    borderColor,
                    borderWidth: 2,
                    borderAlpha: 1,
                    radius: 16
                })
            }

            redraw()

            card.on('pointerover', () => {
                this.hoveredBuildOption = factory
                this.updateBuildPreview()
                redraw('hover')
            })
            card.on('pointerout', () => {
                if (this.getFactoryKey(this.hoveredBuildOption) === this.getFactoryKey(factory)) {
                    this.hoveredBuildOption = null
                    this.updateBuildPreview()
                }
                redraw('default')
            })
            card.on('pointerdown', () => redraw('pressed'))
            card.on('pointerup', (event) => {
                this.selectedBuildOption = factory
                this.hoveredBuildOption = factory
                this.updateBuildPreview()
                redraw('hover')
                this.startBuildingPlacement(factory, event)
            })
            card.on('pointerupoutside', () => redraw('default'))

            const name = this.createFittedText(factory.name, cardWidth - 12, {
                maxFontSize: 14,
                minFontSize: 8
            })
            name.anchor.set(0.5, 0)
            name.x = cardWidth / 2
            name.y = 8

            const iconFrame = new PIXI.Graphics()
            this.drawRoundedRect(iconFrame, cardWidth - 20, usableSpriteHeight + 8, {
                fillColor: 0x0b1721,
                fillAlpha: 0.95,
                borderColor: 0x3f6275,
                borderWidth: 2,
                borderAlpha: 1,
                radius: 12
            })
            iconFrame.x = 10
            iconFrame.y = cardHeight - usableSpriteHeight - 18

            const icon = this.createScaledSprite(factory.sprite?.texture, cardWidth - 28, usableSpriteHeight)
            icon.x = cardWidth / 2
            icon.y = iconFrame.y + ((usableSpriteHeight + 8) / 2)

            card.addChild(background)
            card.addChild(name)
            card.addChild(iconFrame)
            card.addChild(icon)
            gridContent.addChild(card)
        })

        const rowCount = Math.ceil(buildableOptions.length / columns)
        const contentHeight = (rowCount * cardHeight) + (Math.max(0, rowCount - 1) * rowGap)
        const trackHeight = viewport.height
        const maxScroll = Math.max(0, contentHeight - viewport.height)
        const thumbHeight = maxScroll > 0
            ? Math.max(32, (viewport.height / contentHeight) * trackHeight)
            : trackHeight

        let scrollbarThumb = null
        const scrollbarX = viewport.x + viewport.width - 6
        if (maxScroll > 0) {
            const scrollbarTrack = new PIXI.Graphics()
            this.drawRoundedRect(scrollbarTrack, 6, trackHeight, {
                fillColor: 0x09131c,
                fillAlpha: 0.9,
                borderColor: 0x27404f,
                borderWidth: 1,
                borderAlpha: 1,
                radius: 6
            })
            scrollbarTrack.x = scrollbarX
            scrollbarTrack.y = viewport.y
            panel.addChild(scrollbarTrack)

            scrollbarThumb = new PIXI.Graphics()
            this.drawRoundedRect(scrollbarThumb, 6, thumbHeight, {
                fillColor: 0x6daac0,
                fillAlpha: 1,
                borderColor: 0xbfe6f4,
                borderWidth: 1,
                borderAlpha: 1,
                radius: 6
            })
            panel.addChild(scrollbarThumb)
        }

        this.buildGrid = {
            viewport,
            content: gridContent,
            maxScroll,
            scrollbarThumb,
            scrollbarTrackHeight: trackHeight,
            scrollbarThumbHeight: thumbHeight,
            scrollbarX,
            scrollKey: 'buildGridScroll'
        }
        this.buildGrid = this.registerScrollArea(this.buildGrid)
    }

    renderAssignmentTabs(panel, bounds) {
        const filters = [
            { key: 'miner', label: 'Miner' },
            { key: 'builder', label: 'Builder' },
            { key: 'farmer', label: 'Farmer' },
            { key: 'fighter', label: 'Fighter' }
        ]
        const tabGap = 8
        const tabWidth = (bounds.width - (tabGap * (filters.length - 1))) / filters.length

        filters.forEach((filter, index) => {
            const button = this.createButton({
                label: filter.label,
                x: bounds.x + ((tabWidth + tabGap) * index),
                y: bounds.y,
                width: tabWidth,
                height: 38,
                variant: this.assignmentFilter === filter.key ? 'tabActive' : 'tabInactive',
                onClick: () => {
                    this.assignmentFilter = filter.key
                    this.refresh()
                }
            })
            panel.addChild(button)
        })
    }

    createAssignmentEntry(entry, width, onClick) {
        const rowHeight = 76
        const row = new PIXI.Container()
        row.eventMode = 'static'
        row.cursor = 'pointer'

        const background = new PIXI.Graphics()
        const redraw = (state = 'default') => {
            const palette = this.getButtonPalette('card', state)
            this.drawRoundedRect(background, width, rowHeight, {
                fillColor: palette.fillColor,
                fillAlpha: 1,
                borderColor: palette.borderColor,
                borderWidth: 2,
                borderAlpha: 1,
                radius: 16
            })
        }

        redraw()
        row.on('pointerover', () => redraw('hover'))
        row.on('pointerout', () => redraw('default'))
        row.on('pointerdown', () => redraw('pressed'))
        row.on('pointerup', () => {
            redraw('hover')
            if (typeof onClick === 'function') {
                onClick(entry)
            }
        })
        row.on('pointerupoutside', () => redraw('default'))

        const portrait = new PIXI.Graphics()
        portrait.circle(30, 30, 28)
        portrait.fill({ color: 0x0b1721, alpha: 0.98 })
        portrait.circle(30, 30, 28)
        portrait.stroke({ color: 0xa3d9eb, alpha: 1, width: 3 })
        portrait.x = 12
        portrait.y = 8

        const sprite = this.createScaledSprite(entry.texture, 42, 42)
        sprite.x = portrait.x + 30
        sprite.y = portrait.y + 30

        const countText = new PIXI.Text({
            text: String(entry.count),
            style: new PIXI.TextStyle({
                fontFamily: 'Trebuchet MS',
                fontSize: 28,
                fontWeight: 'bold',
                fill: '#eef8ff'
            })
        })
        countText.x = 86
        countText.y = 22

        row.addChild(background)
        row.addChild(portrait)
        row.addChild(sprite)
        row.addChild(countText)
        return { row, rowHeight }
    }

    renderAssignmentBox(panel, {
        x,
        y,
        width,
        height,
        entries,
        emptyText,
        scrollKey,
        onEntryClick
    }) {
        const frame = new PIXI.Graphics()
        this.drawRoundedRect(frame, width, height, {
            fillColor: 0x0d1f2c,
            fillAlpha: 1,
            borderColor: 0x355466,
            borderWidth: 2,
            borderAlpha: 1,
            radius: 18
        })
        frame.x = x
        frame.y = y
        panel.addChild(frame)

        const viewport = {
            x: x + 10,
            y: y + 10,
            width: width - 20,
            height: height - 20
        }

        const mask = new PIXI.Graphics()
        this.drawRoundedRect(mask, viewport.width, viewport.height, {
            fillColor: 0xffffff,
            fillAlpha: 1,
            radius: 12
        })
        mask.x = viewport.x
        mask.y = viewport.y
        panel.addChild(mask)

        const content = new PIXI.Container()
        content.x = viewport.x
        content.y = viewport.y
        content.mask = mask
        panel.addChild(content)

        if (!Array.isArray(entries) || entries.length === 0) {
            const emptyState = this.createBodyText(emptyText, viewport.width - 16)
            emptyState.x = 8
            emptyState.y = 8
            content.addChild(emptyState)

            return this.registerScrollArea({
                viewport,
                content,
                maxScroll: 0,
                scrollbarThumb: null,
                scrollbarTrackHeight: 0,
                scrollbarThumbHeight: 0,
                scrollbarX: 0,
                scrollKey
            })
        }

        const rowGap = 10
        const rowWidth = viewport.width - 18
        let currentY = 0
        for (const entry of entries) {
            const { row, rowHeight } = this.createAssignmentEntry(entry, rowWidth, onEntryClick)
            row.x = 0
            row.y = currentY
            content.addChild(row)
            currentY += rowHeight + rowGap
        }

        const contentHeight = Math.max(0, currentY - rowGap)
        const trackHeight = viewport.height
        const maxScroll = Math.max(0, contentHeight - viewport.height)
        const thumbHeight = maxScroll > 0
            ? Math.max(32, (viewport.height / contentHeight) * trackHeight)
            : trackHeight

        let scrollbarThumb = null
        const scrollbarX = viewport.x + viewport.width - 6
        if (maxScroll > 0) {
            const scrollbarTrack = new PIXI.Graphics()
            this.drawRoundedRect(scrollbarTrack, 6, trackHeight, {
                fillColor: 0x09131c,
                fillAlpha: 0.9,
                borderColor: 0x27404f,
                borderWidth: 1,
                borderAlpha: 1,
                radius: 6
            })
            scrollbarTrack.x = scrollbarX
            scrollbarTrack.y = viewport.y
            panel.addChild(scrollbarTrack)

            scrollbarThumb = new PIXI.Graphics()
            this.drawRoundedRect(scrollbarThumb, 6, thumbHeight, {
                fillColor: 0x6daac0,
                fillAlpha: 1,
                borderColor: 0xbfe6f4,
                borderWidth: 1,
                borderAlpha: 1,
                radius: 6
            })
            panel.addChild(scrollbarThumb)
        }

        return this.registerScrollArea({
            viewport,
            content,
            maxScroll,
            scrollbarThumb,
            scrollbarTrackHeight: trackHeight,
            scrollbarThumbHeight: thumbHeight,
            scrollbarX,
            scrollKey
        })
    }

    renderAssignmentsTab(panel, bounds) {
        this.renderAssignmentTabs(panel, bounds)

        const tabHeight = 38
        const sectionGap = 18
        const labelHeight = 22
        const boxHeight = Math.max(140, Math.floor((bounds.height - tabHeight - labelHeight - (sectionGap * 3)) / 2))
        const assignedBoxY = bounds.y + tabHeight + sectionGap
        const unassignedLabelY = assignedBoxY + boxHeight + sectionGap
        const unassignedBoxY = unassignedLabelY + labelHeight + 6
        const unassignedBoxHeight = Math.max(140, bounds.y + bounds.height - unassignedBoxY)

        const activeEntries = this.buildAssignmentEntries(this.getCreaturesForAssignment(this.assignmentFilter))
        this.renderAssignmentBox(panel, {
            x: bounds.x,
            y: assignedBoxY,
            width: bounds.width,
            height: boxHeight,
            entries: activeEntries,
            emptyText: 'No trilobites are in this assignment.',
            scrollKey: 'assignmentActiveScroll',
            onEntryClick: () => this.transferCreatureAssignment(this.assignmentFilter, 'unassigned')
        })

        const unassignedLabel = new PIXI.Text({
            text: 'Unassigned',
            style: this.textStyles.body
        })
        unassignedLabel.x = bounds.x + 2
        unassignedLabel.y = unassignedLabelY
        panel.addChild(unassignedLabel)

        const unassignedEntries = this.buildAssignmentEntries(this.getCreaturesForAssignment('unassigned'))
        this.renderAssignmentBox(panel, {
            x: bounds.x,
            y: unassignedBoxY,
            width: bounds.width,
            height: unassignedBoxHeight,
            entries: unassignedEntries,
            emptyText: 'No unassigned trilobites are available.',
            scrollKey: 'assignmentUnassignedScroll',
            onEntryClick: () => this.transferCreatureAssignment('unassigned', this.assignmentFilter)
        })
    }

    renderPanel(metrics) {
        const panel = new PIXI.Container()
        panel.x = metrics.panelX
        panel.y = metrics.panelY
        panel.zIndex = 49
        this.root.addChild(panel)

        const panelBackground = new PIXI.Graphics()
        this.drawRoundedRect(panelBackground, metrics.panelWidth, metrics.panelHeight, {
            fillColor: 0x08131d,
            fillAlpha: 0.97,
            borderColor: 0x4d7a8c,
            borderWidth: 3,
            borderAlpha: 1,
            radius: 24
        })
        panel.addChild(panelBackground)

        const title = new PIXI.Text({
            text: 'Colony Menu',
            style: this.textStyles.title
        })
        title.x = metrics.contentPadding
        title.y = 20
        panel.addChild(title)

        const subtitle = new PIXI.Text({
            text: 'Build structures and manage colony assignments.',
            style: this.textStyles.subtitle
        })
        subtitle.x = metrics.contentPadding
        subtitle.y = 50
        panel.addChild(subtitle)

        this.renderTabs(panel, metrics)

        const contentFrameY = 122
        const contentFrame = new PIXI.Graphics()
        this.drawRoundedRect(
            contentFrame,
            metrics.panelWidth - (metrics.contentPadding * 2),
            metrics.panelHeight - contentFrameY - metrics.contentPadding,
            {
                fillColor: 0x0d1c28,
                fillAlpha: 0.9,
                borderColor: 0x233848,
                borderWidth: 2,
                borderAlpha: 1,
                radius: 20
            }
        )
        contentFrame.x = metrics.contentPadding
        contentFrame.y = contentFrameY
        panel.addChild(contentFrame)

        const bounds = {
            x: metrics.contentPadding + 16,
            y: contentFrameY + 16,
            width: metrics.panelWidth - (metrics.contentPadding * 2) - 32,
            height: (metrics.panelHeight - contentFrameY - metrics.contentPadding) - 32
        }

        if (this.activeTab === TAB_ASSIGNMENTS) {
            this.renderAssignmentsTab(panel, bounds)
            return
        }

        this.renderBuildingsTab(panel, bounds)
    }

    refresh() {
        const metrics = this.getLayoutMetrics()
        this.buildPreview = null
        this.buildGrid = null
        this.scrollAreas = []
        this.clearContainer(this.root)

        if (this.panelOpen) {
            this.renderPanel(metrics)
        } else {
            this.renderToggleButton(metrics)
        }
    }

}
