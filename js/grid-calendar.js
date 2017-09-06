"use strict";

class GridCalendar extends HTMLElement {
    constructor() {
        super()

        // Mutation Observer for handling children
        this.mutationObserver = new MutationObserver(this.mutationCallback.bind(this))
    }
    mutationCallback() {
        // Re-sort our children
    }

    translate(string) {
        return string;
    }

    // Basic data binding
    _bind(tag, func) {
        if (!this._bound) {
            this._bound = new Map() // There are better data structures for this.
        }
        if (!this._bound.has(func)) {
            let key = tag.split(',')
            key = key.map(str => str.trim()) // Just in case I'm an idiot elsewhere...
            this._bound.set(func, key) // The functions should be unique, not the list of triggers.
        }
        func()
    }
    _trigger(tag) {
        if (this._bound) {
            for (let [func, key] of this._bound.entries()) {
                if (key.includes(tag)) {
                    func()
                }
            }
        }
    }

    // Build:
    build() {
        this._bind('display', () => {
            if (this.display == 'month') {
                function repeat(num, str) {
                    let out = ""
                    for (let i = 0; i < num; ++i) {
                        out += str
                    }
                    return out
                }
                this.shadowRoot.innerHTML = 
`<link rel="stylesheet" href="css/grid-calendar.css" />
<header>
    <h1></h1>
    <div class="weekday-titles">
        ${repeat(7, '<div></div>')}
    </div>
</header>
<div class="days">
    ${repeat(42, '<div class="day"></div>')}
</div>
<div class="event-container"></div>`
        
                this.elements = {
                    h1: this.shadowRoot.querySelector('h1'),
                    weekdayTitles: this.shadowRoot.querySelectorAll('.weekday-titles *'),
                    days: this.shadowRoot.querySelectorAll('.day'),
                    eventContainer: this.shadowRoot.querySelector('.event-container')
                }
                
                // Give our calendar an accessible name
                // this._bind('lang', () => {
                //     this.setAttribute('aria-label', this.translate('Calendar'))
                // })

                // Fill in the calendar month/year title
                this._bind('lang, view', () => {
                    this.elements.h1.innerText = this.view.toLocaleString(this.locale, {month: "long", year: "numeric"})
                })

                // Fill the weekday titles
                this._bind('lang', () => {
                    let weekdayLongFormatter = new Intl.DateTimeFormat(this.lang, {weekday: 'long'})
                    let date = new Date()
                    date.setDate(date.getDate() - date.getDay())
                    for (let el of this.elements.weekdayTitles) {
                        el.innerText = weekdayLongFormatter.format(date)
                        date.setDate(date.getDate() + 1)
                    }
                })

                // Build all of our dates
                this._bind('view, lang', () => {
                    let iterator = new Date(this.view)
                    iterator.setDate(1 - iterator.getDay()) // Set it to the Sunday before the first of the same month as this.view
                    let column = 0
                    let row = 0
                    for (let el of this.elements.days) {
                        el.innerText = iterator.toLocaleDateString(this.lang, {day: 'numeric'})
                        el.style = `grid-area: r${row}-start / c${column}-start / r${row}-end / c${column}-end;`
                        iterator.setDate(iterator.getDate() + 1)

                        
                        // Calculate our next row/column
                        ++column
                        row += Math.floor(column / 7)
                        column %= 7
                    }
                })

                // Place all of our events into their respective spots.
                this._bind('children', () => {
                    // Used a couple of spots
                    const ONEDAY = 86400000 // 24h/day * 60m/h * 60s/m * 1000ms/s = 86400000ms/day

                    let events = []
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
                                    events.push({
                                        'el': ev,
                                        'slot': this.getSlot(ev),
                                        'sd': sd,
                                        'ed': ed,
                                        'multiday': ed - sd < ONEDAY,
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
                    events.sort((a, b) => {
                        // Note: I believe that there is some redundancy and error in this sorting.  I'll need to play around with it 
                        //  for a while to get something that works most, if not all, of the time.  I just don't have a good enough
                        //  grasp of the pertinent variables.  This is to complex for me to fully reason out so I'm falling back onto 
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
                    
                    // ...and place them in
                    this._bind('view', () => {

                        let workingEvents = Array.from(events)
                        let positions = []
                        let week = new Date(this.view)
                        week.setDate(1 - startDate.getDay())
                        let nextWeek = new Date(week)
                        // I'm pretty sure that view already has it's hours set properly so I shouldn't need to adjust them here
                        weekLoop: for (let week = 0; week < 6; ++week) {
                            let cursor = new Date(week)
                            nextWeek.setDate(nextWeek.getDate() + 7)
                            for (let row = 0; row < 3; ++row) {
                                while (cursor < nextWeek) {
                                    let luckyOneIdx = workingEvents.findIndex(event => event.sd > cursor)
                                    let luckOne = workingEvents[luckyOneIdx]
                                    workingEvents.splice(luckyOneIdx, 1)


                                }
                            }
                            week.setDate(nextWeek.getDate() + 7)
                        }
                    })
                })
            }
        })
    }

    // Slot management
    getSlot(event) {
        if (!this._slotMap) {
            this._slotMap = new WeakMap()
        }
        let slot = this._slotMap.get(event)
        if (!slot) {
            slot = document.createElement('slot')
            this._slotMap.set(event, slot)
        }
        return slot
    }

    // Attributes:
    // selected
    get selected() {

    }
    set selected(newVal) {

        this._trigger('selected')
    }
    // view
    get view() {
        if (!this._view) {
            if (this.hasAttribute('view')) {
                this._view = new Date(this.getAttribute('view'))
            } else {
                this._view = new Date()
            }
            this._view.setDate(1)
            this._view.setHours(0, 0, 0, 0)
        }
        return this._view
    }
    set view(newVal) {
        if (this.hasAttribute('view')) {
            let check = new Date(this.getAttribute('view'))
            if (check.getMonth() != this._view.getMonth() && check.getFullYear() != this._view.getFullYear()) {
                this._view = false
                this._trigger('view')
            }
        }
    }
    get viewRange() {
        let first = new Date(this.view)
        first.setDate(1 - first.getDay())
        let last = new Date(lowest)
        last.setDate(last.getDate() + 42)
        return [first, last]
    }
    // display
    get display() {
        if (!this._display) {
            this._display = this.getAttribute('display') || "month"
        }
        return this._display
    }
    set display(newVal) {
        this._display = false
        this._trigger('display')
    }
    // controls
    get controls() {

    }
    set controls(newVal) {

        this._trigger('controls')
    }
    set suppressControls(newVal) {

        this._trigger('controls')
    }
    // locale
    get lang() {
        if (!this._lang) {
            // Our locale attribute, then the lang attribute on the :root, then the navigator's language
            this._lang = this.getAttribute('lang') || document.querySelector(":root").getAttribute('lang') || navigator.language
        }
        return this._lang
    }
    set lang(newVal) {

        this._trigger('lang')
    }

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

        // Static attributes
        this.tabIndex = 0

        // Apply the template/extract pertinent elements
        this.build()
    }
    disconnectedCallback() {
        // Stop watching our children
        this.mutationObserver.disconnect()
    }
}

customElements.define('grid-calendar', GridCalendar)