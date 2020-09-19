//  Author: ankojh


(async function () {

  //======================================================================================================================

  //  CONSTANTS

  //======================================================================================================================


  const LYRICS_BASEURL = 'https://api.lyrics.ovh/v1'
  const SUGGESTION_BASEURL = 'https://api.lyrics.ovh/suggest'

  let PAGES_CONTAINER_EL;
  let SEARCH_EL;
  let LYRICS_CONTAINER;
  let TEMPLATE_SUGGESTION_PAGE;
  let TEMPLATE_SUGGESTION_CARD;
  let TEMPLATE_SUGGESION_PAGE_DUMMY;


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




    TEMPLATE_SUGGESTION_PAGE = document.querySelector('#nht-suggestion-page')
    TEMPLATE_SUGGESTION_CARD = document.querySelector('#nht-suggestion-card')
    TEMPLATE_SUGGESTION_PAGE_DUMMY = document.querySelector('#nht-suggestion-page-dummy')
  }


  //======================================================================================================================

  //  State

  //======================================================================================================================


  const suggestionsState = {
    pages: [],
    totalPageCount: 0,
  }

  function addSuggestionsPage(pageDetails) {
    const page = new SuggestionPage(pageDetails);
    suggestionsState.pages.push(page);
  }

  function clearSuggestionsPage() {
    suggestionsState.pages.forEach(page=>{
      page.destroy();
    });

    suggestionsState.pages = [];
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

    if(!searchQuery){
      return;
    }

    suggestionsLoader(true);
    const results = await fetchSuggestions(searchQuery);
    suggestionsLoader(false);
    addSuggestionsPage(results);
  }


  //======================================================================================================================

  //  Suggestion Page

  //======================================================================================================================


  class SuggestionPage {
    _pageEl = null
    _pageCards = []
    _pageVisibility = false
    _nextPageURL = ''
    _prevPageURL = ''
    _pageHeight = ''

    constructor(pageDetails) {
      this._addPage(pageDetails);
    }

    _addPage(pageDetails) {
      this._pageEl = TEMPLATE_SUGGESTION_PAGE.content.firstElementChild.cloneNode(true);
      this._pageEl.classList.add('nh-suggestion-page')
      pageDetails.songs.forEach(song => {
        const card = new SuggestionCard(song);
        this._pageEl.insertBefore(card.getCardEl(), null);
        this._pageCards.push(card);
      })

      PAGES_CONTAINER_EL.insertBefore(this._pageEl, null);
      this.setPageHeight();

    }

    destroy() {
      PAGES_CONTAINER_EL.removeChild(this._pageEl);
      this._pageCards.forEach(card=>{
        card.destroy();
      })
    }

    dummifyPage() { //remove content, but maintain height for scroll
      // PAGES_CONTAINER_EL.insertBefore()
      // PAGES_CONTAINER_EL.removeChild(this._pageEl);
    }

    setPageHeight() {
      this._pageHeight = this._pageEl.scrollHeight;
    }
  }


  //======================================================================================================================

  //  Suggestion Card

  //======================================================================================================================


  class SuggestionCard {

    _cardEl
    _song


    constructor(song) {
      this._song = { ...song };
      this.createCard(song);
    }

    createCard(song) {
      this._cardEl = TEMPLATE_SUGGESTION_CARD.content.firstElementChild.cloneNode(true);
      this._cardEl.querySelector('.nh-card__album-cover').src = song.album.picture;
      this._cardEl.querySelector('.nh-card__artist-cover').src = song.artist.picture; 
      this._cardEl.querySelector('.nh-card__song-name').innerText = song.name;
      this._cardEl.querySelector('.nh-card__artist-name').innerText = song.artist.name;

      this._listenToClick();
    }

    getCardEl(){
      return this._cardEl;
    }

    async _cardClicked() {
      const {lyrics} = await fetchLyrics(this._song.artist.name, this._song.name);

      showLyrics(this._song, lyrics)
    }

    _listenToClick() {
      this._cardEl.addEventListener('click', this._cardClicked.bind(this));
    }

    _stopListenToClick() {
      //element will be destroyed
      this._cardEl.removeEventListener('click', this._cardClicked.bind(this));
    }

    destroy() {
      this._stopListenToClick();
      console.log('destroy');
      //delete
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

    if(lyrics){
      LYRICS_CONTAINER.querySelector('.nh-lyrics__lyrics').innerText = lyrics
    }
    else{
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

      if (requestController){
        requestController.abort();
      }

      requestController = new AbortController();
      const signal = requestController.signal;

      return await (await fetch(url, {signal})).json();
    }
    catch (e) {
      throw e;
    }
  }

  async function fetchLyrics(artistName, songName) {
    const result = await fetchRequest(`${LYRICS_BASEURL}/${artistName}/${songName}`)
    return result;
  }


  async function fetchSuggestions(searchQuery) {
    const result = await fetchRequest(`${SUGGESTION_BASEURL}/${searchQuery}`)
    return {
      songs: result.data.map(suggestionsResponseParser),
      nextPageURL: result.next,
      totalSongs: result.total
    }
  }


  //======================================================================================================================

  // Loaders

  //======================================================================================================================


  function suggestionsLoader(show) {

  }


  function pageLoader(show) {

  }

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



