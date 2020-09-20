//  Author: ankojh


(async function () {

  //======================================================================================================================

  //  CONSTANTS

  //======================================================================================================================


  const LYRICS_BASEURL = 'https://api.lyrics.ovh/v1'
  const SUGGESTION_BASEURL = 'https://api.lyrics.ovh/suggest'

  let PAGES_CONTAINER_EL;
  let SEARCH_EL;
  let CONTENT_CONTAINER;
  let LYRICS_CONTAINER;
  let TEMPLATE_SUGGESTION_PAGE;
  let TEMPLATE_SUGGESTION_CARD;


  //======================================================================================================================

  //  INIT

  //======================================================================================================================



  window.onload = function () {
    fetchDomRefs();
    listenToSearchInputChange(searchChanged);
  }


  function fetchDomRefs() {
    PAGES_CONTAINER_EL = document.body.querySelector('#nh-suggestions-pages-container')
    SEARCH_EL = document.querySelector('#nh-song-search');
    LYRICS_CONTAINER = document.querySelector('#nh-lyrics');
    CONTENT_CONTAINER = document.querySelector('.nh-content')


    TEMPLATE_SUGGESTION_PAGE = document.querySelector('#nht-suggestion-page')
    TEMPLATE_SUGGESTION_CARD = document.querySelector('#nht-suggestion-card')
    TEMPLATE_SUGGESTION_PAGE_DUMMY = document.querySelector('#nht-suggestion-page-dummy')
  }


  //======================================================================================================================

  //  State

  //======================================================================================================================

  const pagesState = {
    pageHead: null
  }

  function addSuggestionsPage(URL) {
    pagesState.pageHead = new SuggestionPage(URL);
  }

  function clearSuggestionsPage() {
    PAGES_CONTAINER_EL.style.visibility = 'hidden';
    if (pagesState.pageHead) {
      pagesState.pageHead.destroy()
      pagesState.pageHead = null
    }
  }


  //======================================================================================================================

  // All Time On Listeners

  //======================================================================================================================


  const listenToSearchInputChange = (callback) => {
    const debouncedCallback = debouncedFunc(callback, 500);
    SEARCH_EL.addEventListener('keyup', debouncedCallback);
  }


  //======================================================================================================================

  //  Search

  //======================================================================================================================


  async function searchChanged() {
    const searchQuery = SEARCH_EL.value;

    clearSuggestionsPage();

    if (!searchQuery) {
      CONTENT_CONTAINER.classList.remove('ng-shrink')
      return;
    }

    const URL = `${SUGGESTION_BASEURL}/${searchQuery}`
    addSuggestionsPage(URL);
  }


  //======================================================================================================================

  //  Suggestion Page

  //======================================================================================================================


  class SuggestionPage {

    _pageEl = null
    _pageCards = []
    _pageHeight = null
    _pageWidth = null
    _dummyEl = null
    _intersectionObserver = null  // change name
    _pageDetails = null
    _nextPage = null
    _pageURL = null
    _pageLoaderEl = null



    constructor(pageURL) {
      this._addPage(pageURL);
      this._pageURL = pageURL; //only for testing
    }



    async _addPage(pageURL) {
      PAGES_CONTAINER_EL.style.visibility = 'visible'; // todo
      CONTENT_CONTAINER.classList.add('ng-shrink')  // todo

      await this._fetchPage(pageURL);

      this._pageEl = TEMPLATE_SUGGESTION_PAGE.content.firstElementChild.cloneNode(true);
      this._pageEl.classList.add('nh-suggestion-page')

      const NEXT_PAGE_INDICATOR_AFTER = 0.75;

      const nextPageIndicatorAtIndex = Math.round(this._pageDetails.songs.length * NEXT_PAGE_INDICATOR_AFTER)

      this._pageDetails.songs.forEach((song, index) => {
        let isIndicator = index == nextPageIndicatorAtIndex;
        const card = new SuggestionCard(song, isIndicator ? this._fetchNextPage.bind(this) : null);
        this._pageEl.insertBefore(card.getCardEl(), null);
        this._pageCards.push(card);
      })

      PAGES_CONTAINER_EL.insertBefore(this._pageEl, null);
      this._listenToInteresectionObserver();
    }


    _listenToInteresectionObserver() {
      let options = {
        root: null, //browser viewport
        rootMargin: '100px',
        // threshold: [0, 0.75]
      }

      this._intersectionObserver = new IntersectionObserver(this._handleIntersectionObserver.bind(this), options);
      this._intersectionObserver.observe(this._pageEl);
    }


    _handleIntersectionObserver(observerEntries) {
      const pageObserverEntry = observerEntries[0];

      // if (pageObserverEntry.intersectionRatio > 0.75) {
      //   this._fetchNextPage()
      // }

      if (pageObserverEntry.isIntersecting) {
        if (!this._dummyEl) {
          return;
        }

        this._unDummifyPage();
      }
      else {

        if (this._dummyEl) {
          return;
        }

        this._pageHeight = pageObserverEntry.boundingClientRect.height;
        this._pageWidth = pageObserverEntry.boundingClientRect.width;
        this._dummifyPage();
      }

    }


    _togglePageLoaders(showLoader) { //true or false
      if (showLoader) {
        this._pageLoaderEl = TEMPLATE_SUGGESTION_PAGE.content.firstElementChild.cloneNode(true);

        for (let i = 0; i < 12; i++) {
          const cardEl = document.createElement('div');
          cardEl.classList.add('nh-suggestion-card');
          cardEl.classList.add('nh-card-dummy');
          this._pageLoaderEl.insertBefore(cardEl, null);
        }

        PAGES_CONTAINER_EL.insertBefore(this._pageLoaderEl, null);
      }
      else {
        PAGES_CONTAINER_EL.removeChild(this._pageLoaderEl);
        this._pageLoaderEl = null;
      }
    }



    async _fetchPage(URL) {
      this._togglePageLoaders(true);
      const result = await fetchRequest(URL);
      this._togglePageLoaders(false);
      this._pageDetails = {
        songs: result.data.map(suggestionsResponseParser),
        nextPageURL: this._pageURL,//result.next,
        totalSongs: result.total
      }
    }



    _fetchNextPage() {

      console.log('fetching next page')

      if (!this._nextPage && !this._pageLoaderEl) { // no next page && not loading current page
        this._nextPage = new SuggestionPage(this._pageURL)
        // this._nextPage = new SuggestionPage(this._pageDetails.next) // Ask Satyam for API 
      }
    }



    destroy() {
      if (this._nextPage) {
        this._nextPage.destroy();
      }

      if (this._dummyEl) {
        PAGES_CONTAINER_EL.removeChild(this._dummyEl);
      }
      if (this._pageLoaderEl) {
        PAGES_CONTAINER_EL.removeChild(this._pageLoaderEl);
      }
      else {
        PAGES_CONTAINER_EL.removeChild(this._pageEl);
      }
      this._intersectionObserver.disconnect();

      this._pageEl = null;
      this._dummyEl = null;
      this._pageCards.forEach(card => {
        card.destroy();
      })
    }



    _dummifyPage() { //remove content, but maintain scrollHeight
      this._dummyEl = TEMPLATE_SUGGESTION_PAGE_DUMMY.content.firstElementChild.cloneNode(true);
      this._dummyEl.style.height = this._pageHeight + 'px';
      this._dummyEl.style.width = this._pageWidth + 'px';

      PAGES_CONTAINER_EL.insertBefore(this._dummyEl, this._pageEl);
      PAGES_CONTAINER_EL.removeChild(this._pageEl);
      this._intersectionObserver.unobserve(this._pageEl);
      this._intersectionObserver.observe(this._dummyEl);
    }



    _unDummifyPage() { //opposite of dummify
      PAGES_CONTAINER_EL.insertBefore(this._pageEl, this._dummyEl);
      PAGES_CONTAINER_EL.removeChild(this._dummyEl);

      this._intersectionObserver.unobserve(this._dummyEl);
      this._intersectionObserver.observe(this._pageEl);

      this._dummyEl = null;
    }
  }


  //======================================================================================================================

  //  Suggestion Card

  //======================================================================================================================


  class SuggestionCard {

    _cardEl
    _song
    _clickHandler
    _intersectionObserver


    constructor(song, intersectionCallback) {
      this._song = { ...song };
      this.createCard(song);

      if(intersectionCallback){
      this._intersectionObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          this._intersectionObserver.unobserve(this._cardEl);
          this._intersectionObserver.disconnect();
          this._intersectionObserver = null;
          intersectionCallback();
        }
      });

      this._intersectionObserver.observe(this._cardEl);
    }

      this._clickHandler = this._cardClicked.bind(this);
    }

    createCard(song) {
      this._cardEl = TEMPLATE_SUGGESTION_CARD.content.firstElementChild.cloneNode(true);

      const albumCover = this._cardEl.querySelector('.nh-card__album-cover');
      albumCover.src = song.album.picture;
      albumCover.alt = song.album.name.substr(0, 10);

      const artistCover = this._cardEl.querySelector('.nh-card__artist-cover');
      artistCover.src = song.artist.picture;
      artistCover.alt = song.artist.name.substr(0, 10);;

      this._cardEl.querySelector('.nh-card__song-name').innerText = song.name;
      this._cardEl.querySelector('.nh-card__artist-name').innerText = song.artist.name;

      this._listenToClick();
    }

    getCardEl() {
      return this._cardEl;
    }

    async _cardClicked() {
      const { lyrics } = await fetchLyrics(this._song.artist.name, this._song.name);
      showLyrics(this._song, lyrics)
    }

    _listenToClick() {
      this._cardEl.addEventListener('click', this._clickHandler);
    }

    _stopListenToClick() {
      this._cardEl.removeEventListener('click', this._clickHandler);
    }

    destroy() {
      this._stopListenToClick();
      this._cardEl = null
    }
  }



  //======================================================================================================================

  //  Lyrics Dialog

  //======================================================================================================================

  const showLyrics = (song, lyrics) => {
    LYRICS_CONTAINER.classList.add('show__lyrics');

    LYRICS_CONTAINER.querySelector('.nh-lyrics__close').addEventListener('click', removeLyrics);
    LYRICS_CONTAINER.querySelector('.nh-lyrics__song-name').innerText = song.name;
    LYRICS_CONTAINER.querySelector('.nh-lyrics__album-name').innerText = song.album.name;
    LYRICS_CONTAINER.querySelector('.nh-lyrics__artist-name').innerText = song.artist.name;

    if (lyrics) {
      LYRICS_CONTAINER.querySelector('.nh-lyrics__lyrics').innerText = lyrics
    }
    else {
      LYRICS_CONTAINER.querySelector('.nh-lyrics__lyrics').innerText = 'No Lyrics Found'
    }
  }

  const removeLyrics = () => {
    LYRICS_CONTAINER.classList.remove('show__lyrics');
    LYRICS_CONTAINER.querySelector('.nh-lyrics__close').removeEventListener('click', removeLyrics);
    LYRICS_CONTAINER.querySelector('.nh-lyrics__song-name').innerText = '';
    LYRICS_CONTAINER.querySelector('.nh-lyrics__album-name').innerText = '';
    LYRICS_CONTAINER.querySelector('.nh-lyrics__artist-name').innerText = '';
    LYRICS_CONTAINER.querySelector('.nh-lyrics__lyrics').innerText = ''
  }


  //======================================================================================================================

  //  Fetch

  //======================================================================================================================


  let requestController;

  async function fetchRequest(url) {
    try {

      if (requestController) {
        requestController.abort();
      }

      requestController = new AbortController();
      const signal = requestController.signal;

      return await (await fetch(url, { signal })).json();
    }
    catch (e) {
      throw e;
    }
  }

  async function fetchLyrics(artistName, songName) {
    const result = await fetchRequest(`${LYRICS_BASEURL}/${artistName}/${songName}`)
    return result;
  }


  //======================================================================================================================

  // Loaders

  //======================================================================================================================


  function lyricsLoader(show) {

  }


  //======================================================================================================================

  //  Utils

  //======================================================================================================================

  function debouncedFunc(func, timeInMS) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func(...args);
      }, timeInMS);
    }
  }

  function throttleFunc(func, timeInMS) {
    let breathing = false;
    return (...args) => {
      if (!breathing) {
        breathing = true
        func(...args);
        setTimeout(() => {
          breathing = false;
        }, timeInMS);
      }
    }
  }

  function suggestionsResponseParser(song) {
    return {
      id: song.id,
      name: song.title_short,
      preview: song.preview,
      album: {
        id: song.album && song.album.id,
        name: song.album && song.album.title,
        picture: song.album && song.album.cover,
        pictureXL: song.album && song.album.cover_xl,
      },
      artist: {
        id: song.artist && song.artist.id,
        name: song.artist && song.artist.name,
        picture: song.artist && song.artist.picture,
        pictureXL: song.artist && song.artist.picture_xl,
      }
    }
  }

})();



