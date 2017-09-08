"use strict";

const ONEDAY = 86400000 // 24h/day * 60m/h * 60s/m * 1000ms/s = 86400000ms/day

class BasicCalendar extends HTMLElement {
    // Constructor
    constructor() {
        super()

        // Mutation Observer for handling new events
        this.mutationObserver = new MutationObserver(this.mutationCallback.bind(this))
    }

    mutationCallback(mutations) { // Trigger (Conditional): children
        mutations.forEach(mutation => {
            if (mutation.type == 'childList') {
                if (mutation.addedNodes.length != 0 || mutation.removedNodes.length != 0) {
                    this.run('children')
                }
            }
        })
    }

    build() { // Bind: display

        if (this.display == 'month') {
            function repeat(num, str) { // Maybe this should be a static _repeat()?
                let out = ""
                for (let i = 0; i < num; ++i) {
                    out += str
                }
                return out
            }
            // Apply our template
            this.shadowRoot.innerHTML = `
                <link rel="stylesheet" href="css/basic-calendar.css">
                <table>
                    <thead>
                        <tr><th colspan="7"><h1><input type="month"></h1></th></tr>
                        <tr class="weekday-titles">
                            ${repeat(7, `<th></th>`)}
                        </tr>
                    </thead>
                    <tbody>
                        ${repeat(6, `<tr>
                            ${repeat(7, `<td tabindex="-1">
                                <div class="date"></div>
                                <div class="event-list"></div>
                            </td>`)}
                        </tr>`)}
                    </tbody>
                </table>
            `

            // All the elements:
            this.elements = {
                table: this.shadowRoot.querySelector('table'),
                monthTitle: this.shadowRoot.querySelector('input[type="month"]'),
                weekdayTitles: this.shadowRoot.querySelectorAll('.weekday-titles th'),
                cells: this.shadowRoot.querySelectorAll('td'),
                eventContainers: this.shadowRoot.querySelectorAll('.event-list'),
                dateTitles: this.shadowRoot.querySelectorAll('td > .date')
            }

            // Event Handlers
            this.link()

            // Fill in the calendar
            this.fill()
        }
    }

    // BEGIN TODO: Refactor
    /*
    putControls(parent) {
        let container = document.createElement('span')

        if (this.controls.includes('change-view')) {
            let prevMonth = document.createElement('button')
            prevMonth.innerText = '<'
            prevMonth.onclick = (e) => {
                e.preventDefault()
                this.view.setMonth(this.view.getMonth() - 1)
                this.view = this.view // Just to trigger our setter
                console.log('prev-month')
            }
            let nextMonth = document.createElement('button')
            nextMonth.innerText = '>'
            nextMonth.onclick = (e) => {
                e.preventDefault()
                this.view.setMonth(this.view.getMonth() + 1)
                this.view = this.view // Just to trigger our setter
                console.log('next-month')
            }
            container.appendChild(prevMonth)
            container.appendChild(nextMonth)
        }

        parent.appendChild(container)
    } */
    // END TODO

    link() {
        // Event listener to select a day

        const getDate = (index) => {
            let [first] = this.viewRange
            let result = new Date(first)
            result.setDate(result.getDate() + index)
            result.setHours(0, 0, 0, 0)
            return result
        }
        const selectCell = (index, el) => {
            if (this.controls.includes('select-date')){
                let newSelected = getDate(index)
                this.setAttribute('selected', newSelected.toDateString())
            }
        }

        // Listeners for handling focus and movement with the arrow keys
        const onFocus = (index, el) => {
            this.setAttribute('selected', getDate(index).toDateString())
        }
        const moveFocus = (e, index) => {
            let next = null
            let nextIndex = 0
            switch (e.key){
                case "ArrowLeft":
                    nextIndex = index - 1
                    break;
                case "ArrowUp":
                    nextIndex = index - 7
                    break;
                case "ArrowRight":
                    nextIndex = index + 1
                    break;
                case "ArrowDown":
                    nextIndex = index + 7
                    break;
                default:
                    return
            }
            next = this.elements.cells[nextIndex]
            if (next) {
                next.focus()
            } else {
                let nextDate = getDate(nextIndex)
                this.setAttribute('view', nextDate.toDateString())
                this.setAttribute('selected', nextDate.toDateString())
            }
        }
        
        // Actually apply the event listeners
        this.elements.cells.forEach((el, idx) => {
            el.addEventListener('click', selectCell.bind(null, idx, el))
            el.addEventListener('focus', onFocus.bind(null, idx, el))
            el.addEventListener('keydown', e => moveFocus(e, idx))
        })

        // Hook into the controls we have
        this.elements.monthTitle.addEventListener('change', (e) => {
            let [year, month] = this.elements.monthTitle.getAttribute('value').split('-')
            let newView = new Date()
            newView.setFullYear(year)
            newView.setMonth(month)
            newView.setDate(1)
            this.setAttribute('view', newView.toDateString())
        })
    }
    run(trigger) {
        const map = {
            'view': () => {
                this.monthYearTitle()
                this.selected = false // Trigger the setter
                this.viewRange = false
            },
            'display': () => {
                this.build()
            },
            'lang': () => {
                this.weekdayTitles()
                this.dateNumbers()
            },
            'view-range': () => {
                this.dateNumbers()
                this.applyClasses()
                this.placeEvents()
            },
            'children': () => {
                this.placeEvents()
                this.events = false
            },
            'selected': () => {
                this.handleSelected()
            },
            'controls': () => {
                this.build()
            }
        }
        // Run the trigger
        if (map[trigger]) {
            map[trigger]()
        }
    }

    monthYearTitle() { // Bind: view
        let month = "" + (this.view.getMonth() + 1)
        if (month.length < 2) {
            month = "0" + month
        }
        let year = this.view.getFullYear()
        this.elements.monthTitle.setAttribute('value', `${year}-${month}`)
    }
    weekdayTitles() { // Bind: lang
        let weekdayLongFormatter = new Intl.DateTimeFormat(this.lang, {weekday: 'long'})
        let date = new Date()
        date.setDate(date.getDate() - date.getDay())
        for (let el of this.elements.weekdayTitles) {
            el.innerText = weekdayLongFormatter.format(date)
            date.setDate(date.getDate() + 1)
        }
    }
    dateNumbers() { // Bind: view-range, lang
        let [first] = this.viewRange
        let iterator = new Date(first)

        for (let el of this.elements.dateTitles) {
            el.innerText = iterator.toLocaleDateString(this.lang, {day: 'numeric'})
            iterator.setDate(iterator.getDate() + 1)
        }
    }
    handleSelected() { // Bind: selected
        // Clear the selected class on any previously selected cell
        let pastSelected = this.shadowRoot.querySelector('.selected')
        if (pastSelected) {
            pastSelected.classList.remove('selected')
            pastSelected.tabIndex = "-1"
        }

        // Make sure that selected is available
        if (this.controls.includes('select-date')) {
            if (this.selected) {
                // Set the selected class on any newly selected cell
                let cell = this.getCell(this.selected)
                if (cell) {
                    // I'm setting the class on the td of the table, which is the parent of the slot
                    cell.classList.add('selected')
                    cell.tabIndex = "0"
                    cell.focus()
                }
            } else {
                // Don't select the view but put it in the tab order
                this.getCell(this.view).tabIndex = "0"
            }
        }
    }
    placeEvents(/* TODO: only update the days we need to newNodes, oldNodes*/) {
        let [firstDay, lastDay] = this.viewRange
        
        // First, clear all the event lists
        this.elements.eventContainers.forEach(el => 
            Array.from(el.children).forEach(last => 
                last.remove())
        )

        // When we're actually placing events, I only want to place events that are visible
        let workingEvents = Array.from(this.events)
        workingEvents.filter(event => {
            return event.ed >= firstDay && event.sd < lastDay
        })

        // Get the slots all setup
        workingEvents.forEach((event, eventIdx) => {
            event.slot.setAttribute('name', 's-' + eventIdx)
            event.el.setAttribute('slot', 's-' + eventIdx)
        })

        // Used for each day
        let iterator = null

        // Check to make sure that we're inside our week
        let beginOfWeek = new Date(firstDay)
        let endOfWeek = new Date(iterator)
        endOfWeek.setDate(endOfWeek.getDate() + 7)

        // For each of the 6 weeks that we display in month view ...
        for (let week = 0; week < 6; ++week) {
            
            // ... Loop through at least 4 rows but display all events ...
            const MIN_ROWS = 4
            let eventAdded = false
            for (let row = 0; row < MIN_ROWS || eventAdded; ++row) {
                // TODO: display a "See All" feature
                eventAdded = false
                iterator = new Date(beginOfWeek)
                // ... Adding an event (or spacer) for each day ...
                for (let cell = 0; cell < 7; /* We increment the cell bellow */) {
                    // Find the first event that can fit on this day
                    let eventIdx = workingEvents.findIndex(ev => {
                        if (ev.sd >= iterator && ev.sd - iterator < ONEDAY) {
                            return true
                        }
                    })

                    let newEl = null
                    if (eventIdx == -1) {
                        // If there isn't an event then we'll just insert
                        //  A spacer.
                        iterator.setDate(iterator.getDate() + 1)
                        this.elements.eventContainers[7 * week + cell].appendChild(this.createSpacer())

                        // Move to the next cell
                        ++cell
                    } else {
                        // If there is an event, then we'll add it.
                        eventAdded = true
                        let [event] = workingEvents.splice(eventIdx, 1)
                        
                        let numDays = Math.ceil(event.duration / ONEDAY)
                        if (numDays > 1)  {
                            // The ${numDays - 1}px is for the borders that we cross
                            event.el.style.width = `calc(${numDays}00% + ${numDays - 1}px)`
                            // And if the event is bigger then a day, then 
                            //  We'll insert spacers into each day that the 
                            //  event spans.
                            for (let i = 1; i < numDays; ++i) {
                                this.elements.eventContainers[7 * week + cell + i].appendChild(this.createSpacer())
                            }
                        } else {
                            event.slot.removeAttribute('style')
                        }
                        // Actually place the event into the cell's event container
                        this.elements.eventContainers[7 * week + cell].appendChild(event.slot)

                        // Move to the next day that isn't occupied by our multiday event
                        cell += numDays
                        iterator.setDate(iterator.getDate() + numDays)
                    }
                }
            }
            beginOfWeek.setDate(beginOfWeek.getDate() + 7)
            endOfWeek.setDate(endOfWeek.getDate() + 7)
        }
    }
    applyClasses() { // Bind: view-range
        let [first, last] = this.viewRange
        let iterator = new Date(first)
        
        let today = new Date()

        for (let cell of this.elements.cells) {
            // Is the cell today?
            today.setHours(0, 0, 0, 0)
            let diff = iterator - today
            if (diff >= 0 && diff < ONEDAY) {
                cell.classList.add('today')
            } else {
                cell.classList.remove('today')
            }
    
            // Is the cell within the same month as selected?
            if (iterator.getMonth() == this.view.getMonth() && iterator.getFullYear() == this.view.getFullYear()) {
                cell.classList.add('in-month')
            } else {
                cell.classList.remove('in-month')
            }
            iterator.setDate(iterator.getDate() + 1)
        }
    }

    fill() { // Just a container to distinguish the html generation from the inserting data into it
        // Month-Year Title:
        this.monthYearTitle()
        
        // Weekday Titles:
        this.weekdayTitles()

        // Date Numbers:
        this.dateNumbers()
        
        // Selected 
        this.handleSelected()

        // Apply Classes
        this.applyClasses()

        // Put all of our events where the go:
        this.placeEvents()
    }

    // Slot, Spacer and Cell Access
    getSlot(element) {
        if (!this._slotMap) {
            this._slotMap = new WeakMap()
        }
        let slot = this._slotMap.get(element)
        if (!slot) {
            slot = document.createElement('slot')
            this._slotMap.set(element, slot)
        }
        return slot
    }
    getCell(date) {
        let [first] = this.viewRange
        /* Old Code, didn't account for daylight savings time with the Math.ceil
        // 
        let index = Math.ceil((date - first) / ONEDAY)
        return this.elements.cells[index] // Could be undefined
        */
        let iterator = new Date(first)
        let index = 0
        while (iterator < date) {
            ++index;
            iterator.setDate(iterator.getDate() + 1)
        }
        return this.elements.cells[index]
    }
    getEventList(cell) {
        return cell.querySelector('.event-list')
    }
    createSpacer() {
        let el = document.createElement('div')
        el.classList.add('spacer')
        return el
    }

    // Setters and Getters
    // Event List
    get events() {
        if (!this._events) {
            this._events = []
            for (let ev of this.children) {
                if (ev.hasAttribute('start-date') && ev.hasAttribute('end-date')) {
                    let sd = new Date(ev.getAttribute('start-date'))
                    let ed = new Date(ev.getAttribute('end-date'))
                    // Make certain that the date objects are valid
                    if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
                        
                        // Now, make sure that the event doesn't span a week boundary.  Split it into multiple events.
                        let max = new Date(sd)
                        max.setDate(max.getDate() + 7 - max.getDay())
                        max.setHours(0,0,0,0)
                        if (ed < max) {
                            this._events.push({
                                'el': ev,
                                'slot': this.getSlot(ev),
                                'sd': sd,
                                'ed': ed,
                                'multiday': ed - sd > ONEDAY,
                                'duration': ed - sd
                            })
                        } else {
                            console.error(ev, new Error("Events in a grid-calendar cannot span from one week to another.  Please split it into multiple events."))
                        }
                    } else {
                        console.error(ev, new Error("Event doesn't have valid a start-date or it doesn't have a valid end-date"))
                    }
                }
            }

            // Sort our events into the proper order...
            this._events.sort((a, b) => {
                // Note: I believe that there is some redundancy and error in this sorting.  I'll need to play around with it 
                //  for a while to get something that works most, if not all, of the time.  I just don't have a good enough
                //  grasp of the pertinent variables.  This is too complex for me to fully reason out so I'm falling back onto 
                //  trial and error.
                if (a.multiday && !b.multiday) {
                    return -1
                } else if (b.multiday && !a.multiday) {
                    return 1
                } else if (a.multiday && b.multiday) {
                    // Which multiday event should go first
                    return  a.sd - b.sd // Whichever comes first?
                } else {
                    if (a.ed < b.sd) {
                        return -1
                    } else if (b.ed < a.sd) {
                        return 1
                    } else { // They overlap at least some
                        return a.sd - b.sd
                    }
                }
            })
        }
        return this._events
    }
    set events(newVal) { // Trigger: event-list & Bind: children
        this._events = false
        this.run('event-list')
    }
    // Selected
    get selected() {
        if (this._selected === undefined) {
            this._selected = false
        }
        return this._selected
    }
    set selected(newVal) { // Trigger (Conditional): selected & Bind: view
        if (this.controls.includes('select-date')) {
            if (this.hasAttribute('selected')) {
                this._selected = new Date(this.getAttribute('selected'))
                this._selected.setHours(0, 0, 0, 0) // Just so that you can check if a date is withing 24h after selected.
            }
        } else {
            this._selected = false
        }
        
        // Dispatch an event
        let ev = new Event('selected', {detail: new Date(this.selected)})
        this.dispatchEvent(ev)
        this.run('selected')
    }
    // View
    get view() {
        if (!this._view) {
            this.view = false
        }
        return this._view
    }
    set view(newView) { // Trigger (conditional): view
        if (this._view) {
            let check = new Date(this.getAttribute('view'))
            check.setHours(0, 0, 0, 0)
            if (this._view.valueOf() != check.valueOf()) {
                this._view = check
                // Trigger: view
                this.run('view')
            }
        } else {
            if (this.hasAttribute('view')) {
                this._view = new Date(this.getAttribute('view'))
            } else {
                this._view = new Date()
                this._view.setDate(1)
            }
            this._view.setHours(0, 0, 0, 0)
        }
    }
    // View Range
    get viewRange() {
        if (!this._viewRange) {
            // This is an anomaly.  Rather then calculating the value 
            //  in the getter, I'm going to calculate it in the setter.
            //  The reason for this is because I need to calculate the
            //  value to know if it has changed.
            this.viewRange = false // Trigger setter
        }
        return this._viewRange
    }
    set viewRange(newVal) { // Trigger (Conditional): view-range & Bind: view
        let first = new Date(this.view)
        first.setDate(1)
        first.setDate(1 - first.getDay())
        first.setHours(0, 0, 0, 0)
        let last = new Date(first)
        last.setDate(last.getDate() + 41)
        last.setHours(23, 59, 59, 999)
        if (!this._viewRange || (
          first.valueOf() != this._viewRange[0].valueOf() &&
          last.valueOf() != this._viewRange[1].valueOf())) {

            this._viewRange = [first, last]
            // Trigger: view-range
            let ev = new Event('view-range', { detail: [new Date(first), new Date(last)]})
            this.dispatchEvent(ev)
            this.run('view-range')
        }
    }
    // Display
    get display() {
        if (!this._display) {
            this._display = this.getAttribute('display') || 'month'
        }
        return this._display
    }
    set display(newVal) { // Trigger: display
        this._display = false

        // Dispatch an event
        let ev = new Event('display', {detail: new String(this.display)})
        this.dispatchEvent(ev)
        this.run('display')
    }
    // Controls
    get controls() {
        if (!this._controls) {
            const DEFAULT_CONTROLS = ['select-date', 'add-event', 'change-view', 'change-display']

            // Fill the controls with all the defaults 
            if (this.hasAttribute('controls')) {
                this._controls = this.getAttribute('controls')
            } else {
                this._controls = Array.from(DEFAULT_CONTROLS) // Is there a better way to copy an array?
            }

            // Check the controls for any suppressed controls
            if (this.hasAttribute('controls')) {
                let suppress = this.getAttribute('suppress-controls').split(',')
                suppress = suppress.map(str => str.trim())
                this._controls = this._controls.filter(control => !suppress.includes(control))
            }
        }
        return this._controls
    }
    set controls(newControls) { // Trigger: controls
        this._controls = false
        
        // Dispatch an event
        let ev = new Event('controls', {detail: Array.from(this.controls)})
        this.dispatchEvent(ev)
        this.run('controls')
    }
    set suppressControls(newVal) { // Trigger (Indirectly): controls
        this.controls = false
    }
    // Language
    get lang() {
        if (!this._lang) {
            // Our locale attribute, then the lang attribute on the :root, then the navigator's language
            this._lang = this.getAttribute('lang') || 
                document.querySelector(":root").getAttribute('lang') || 
                navigator.language
        }
        return this._lang
    }
    set lang(newVal) { // Trigger: lang
        this._lang = false
            
        // Dispatch an event
        let ev = new Event('lang', {detail: this.lang})
        this.dispatchEvent(ev)
        this.run('lang')
    }

    // Attributes    
    static get observedAttributes() {
        return ['selected', 'view', 'display', 'controls', 'suppress-controls', 'lang']
    }
    attributeChangedCallback(attributeName, oldValue, newValue) {
        if (oldValue != newValue) { 
            // There is no need to check if we have a setter/getter for the attribute because
            //  of the observedAttributes function

            // All of our setters will calculate their value directly from the element's attributes we're just triggering their setter
            this[attributeName.replace(/-(\w)/, (match, char) => char.toUpperCase())] = false 
        }
    }

    // Lifecycle Callbacks
    connectedCallback() {
        // Start watching our children
        this.mutationObserver.observe(this, {childList: true, subtree: true, attributes: true})

        // Create a Shadow DOM
        this.attachShadow({
            mode: 'open'
        })

        // Build the calendar
        this.build()
    }
    disconnectedCallback() {
        // Stop watching our children
        this.mutationObserver.disconnect()
    }
}

customElements.define('basic-calendar', BasicCalendar)