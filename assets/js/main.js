/* GEKKO COLLECTION — shared behaviour: mobile nav, dropdown, i18n switch, quickbooker + calendar, cursor */
(function(){
  var LANGS = ['en','de','gr','sq'];
  var qbRefreshers = [];

  function getLang(){
    var p = new URLSearchParams(window.location.search).get('lang');
    return LANGS.indexOf(p) > -1 ? p : 'en';
  }

  function localeForLang(lang){ return lang === 'gr' ? 'el' : lang; }

  function applyLang(lang){
    var dict = (window.TRANSLATIONS && window.TRANSLATIONS[lang]) || {};
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined){
        if (el.hasAttribute('data-i18n-html')) el.innerHTML = dict[key];
        else el.textContent = dict[key];
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
      var key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) el.setAttribute('placeholder', dict[key]);
    });
    document.documentElement.setAttribute('lang', lang === 'gr' ? 'el' : lang);
    document.querySelectorAll('.lang-menu button, .lang-switch button').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    document.querySelectorAll('.lang-current-code').forEach(function(el){
      el.textContent = lang.toUpperCase();
    });
    // preserve language across internal navigation
    document.querySelectorAll('a[data-internal]').forEach(function(a){
      var base = a.getAttribute('data-internal');
      a.setAttribute('href', lang === 'en' ? base : base + (base.indexOf('?') > -1 ? '&' : '?') + 'lang=' + lang);
    });
    // re-run any quickbooker refreshers so selected dates re-render in the new language
    qbRefreshers.forEach(function(fn){ fn(); });
  }

  /* ---------------- shared dark calendar dropdown ---------------- */
  var calOpenPanel = null, calOpenField = null;

  function pad2(n){ return n < 10 ? '0' + n : '' + n; }
  function toISO(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function fromISO(s){ if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function sameDay(a, b){ return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function startOfDay(d){ var c = new Date(d); c.setHours(0,0,0,0); return c; }

  function closeCalendar(){
    if (calOpenPanel){ calOpenPanel.remove(); }
    if (calOpenField){
      calOpenField.classList.remove('open');
      var b = calOpenField.querySelector('.qb-datebtn');
      if (b) b.setAttribute('aria-expanded', 'false');
    }
    calOpenPanel = null; calOpenField = null;
  }

  function positionPanel(panel, fieldEl){
    var r = fieldEl.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var pw = panel.offsetWidth || 320, ph = panel.offsetHeight || 360;
    var left = r.left;
    if (left + pw > vw - 16) left = vw - pw - 16;
    if (left < 16) left = 16;
    var top = r.bottom + 8;
    if (top + ph > vh - 16) top = Math.max(16, r.top - ph - 8);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  // opts: { value:Date|null, min:Date, dict:{}, onSelect:fn(date), onClear:fn() }
  function openCalendar(fieldEl, opts){
    if (calOpenField === fieldEl){ closeCalendar(); return; }
    closeCalendar();

    var panel = document.createElement('div');
    panel.className = 'qb-calendar-panel';
    document.body.appendChild(panel);

    var view = opts.value
      ? new Date(opts.value.getFullYear(), opts.value.getMonth(), 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    function render(){
      var lang = getLang();
      var loc = localeForLang(lang);
      var monthLabel = view.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
      monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

      var wdHtml = '';
      for (var i = 0; i < 7; i++){
        var wd = new Date(2023, 0, 1 + i); // a Sunday-start week
        wdHtml += '<span>' + wd.toLocaleDateString(loc, { weekday: 'short' }).slice(0, 2) + '</span>';
      }

      var firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
      var startOffset = firstOfMonth.getDay();
      var daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var today = startOfDay(new Date());
      var minDate = opts.min ? startOfDay(opts.min) : today;

      var cells = '';
      for (var e = 0; e < startOffset; e++) cells += '<span class="qb-cal-day qb-cal-day--empty"></span>';
      for (var d = 1; d <= daysInMonth; d++){
        var thisDate = new Date(view.getFullYear(), view.getMonth(), d);
        var disabled = thisDate < minDate;
        var isToday = sameDay(thisDate, today);
        var isSelected = opts.value && sameDay(thisDate, opts.value);
        var cls = 'qb-cal-day' + (isToday ? ' qb-cal-day--today' : '') + (isSelected ? ' qb-cal-day--selected' : '');
        cells += '<button type="button" class="' + cls + '" ' + (disabled ? 'disabled' : '') + ' data-date="' + toISO(thisDate) + '">' + d + '</button>';
      }

      panel.innerHTML =
        '<div class="qb-cal-head">' +
          '<span class="qb-cal-title">' + monthLabel + '</span>' +
          '<div class="qb-cal-nav">' +
            '<button type="button" class="qb-cal-prev" aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>' +
            '<button type="button" class="qb-cal-next" aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>' +
          '</div>' +
        '</div>' +
        '<div class="qb-cal-weekdays">' + wdHtml + '</div>' +
        '<div class="qb-cal-grid">' + cells + '</div>' +
        '<div class="qb-cal-foot">' +
          '<button type="button" class="qb-cal-clear">' + (opts.dict.qb_cal_clear || 'Clear') + '</button>' +
          '<button type="button" class="qb-cal-today">' + (opts.dict.qb_cal_today || 'Today') + '</button>' +
        '</div>';

      panel.querySelector('.qb-cal-prev').addEventListener('click', function(ev){ ev.stopPropagation(); view.setMonth(view.getMonth() - 1); render(); });
      panel.querySelector('.qb-cal-next').addEventListener('click', function(ev){ ev.stopPropagation(); view.setMonth(view.getMonth() + 1); render(); });
      panel.querySelectorAll('.qb-cal-day[data-date]').forEach(function(btn){
        btn.addEventListener('click', function(ev){
          ev.stopPropagation();
          opts.onSelect(fromISO(btn.getAttribute('data-date')));
        });
      });
      panel.querySelector('.qb-cal-clear').addEventListener('click', function(ev){ ev.stopPropagation(); opts.onClear(); });
      panel.querySelector('.qb-cal-today').addEventListener('click', function(ev){
        ev.stopPropagation();
        var t = startOfDay(new Date());
        if (t < minDate) return;
        opts.onSelect(t);
      });

      positionPanel(panel, fieldEl);
    }

    render();
    requestAnimationFrame(function(){ panel.classList.add('open'); });
    fieldEl.classList.add('open');
    var btn = fieldEl.querySelector('.qb-datebtn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    calOpenPanel = panel; calOpenField = fieldEl;
  }

  document.addEventListener('click', function(e){
    if (!calOpenPanel) return;
    if (calOpenPanel.contains(e.target) || (calOpenField && calOpenField.contains(e.target))) return;
    closeCalendar();
  });
  window.addEventListener('resize', closeCalendar);
  window.addEventListener('scroll', function(){ if (calOpenPanel) closeCalendar(); }, true);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeCalendar(); });

  document.addEventListener('DOMContentLoaded', function(){
    // tag internal nav links once so applyLang can rewrite them
    document.querySelectorAll('a[href]').forEach(function(a){
      var href = a.getAttribute('href');
      if (href && !href.match(/^(https?:|mailto:|tel:|#)/) && !a.hasAttribute('data-internal')){
        a.setAttribute('data-internal', href.split('?')[0]);
      }
    });

    applyLang(getLang());

    document.querySelectorAll('.lang-menu button, .lang-switch button').forEach(function(btn){
      btn.addEventListener('click', function(){
        var lang = btn.getAttribute('data-lang');
        var url = new URL(window.location.href);
        if (lang === 'en') url.searchParams.delete('lang'); else url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url);
        applyLang(lang);
        var dd = btn.closest('.lang-dropdown');
        if (dd) dd.classList.remove('open');
      });
    });

    // language dropdown open/close
    document.querySelectorAll('.lang-dropdown').forEach(function(dd){
      var trigger = dd.querySelector('.lang-current');
      if (!trigger) return;
      trigger.addEventListener('click', function(e){
        e.stopPropagation();
        var willOpen = !dd.classList.contains('open');
        document.querySelectorAll('.lang-dropdown.open').forEach(function(o){ o.classList.remove('open'); });
        if (willOpen) dd.classList.add('open');
      });
    });
    document.addEventListener('click', function(){
      document.querySelectorAll('.lang-dropdown.open').forEach(function(o){ o.classList.remove('open'); });
    });

    var toggle = document.querySelector('.nav-toggle');
    var overlay = document.querySelector('.nav-overlay');
    var closeBtn = document.querySelector('.nav-overlay-close');
    function openNav(){ if(!overlay) return; overlay.classList.add('open'); toggle && toggle.classList.add('open'); document.body.style.overflow='hidden'; }
    function closeNav(){ if(!overlay) return; overlay.classList.remove('open'); toggle && toggle.classList.remove('open'); document.body.style.overflow=''; }
    if (toggle && overlay){
      toggle.addEventListener('click', function(){
        overlay.classList.contains('open') ? closeNav() : openNav();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    if (overlay){
      overlay.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeNav); });
    }
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeNav(); });

    // ---- quickbooker widget: destination / check-in / check-out / book ----
    document.querySelectorAll('.qb-form').forEach(function(form){
      var dest = form.querySelector('.qb-item-destination select');
      var checkinField = form.querySelector('[data-field="checkin"]');
      var checkoutField = form.querySelector('[data-field="checkout"]');
      var checkin = form.querySelector('.qb-checkin');
      var checkout = form.querySelector('.qb-checkout');
      var fakeIn = form.querySelector('.qb-fakedate-in');
      var fakeOut = form.querySelector('.qb-fakedate-out');
      var submit = form.querySelector('.qb-item-submit button');

      var checkinDate = null, checkoutDate = null;

      function fmt(d){
        var loc = localeForLang(getLang());
        return d.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' });
      }
      function emptyLabel(span){
        var key = span && span.getAttribute('data-i18n');
        var d = (window.TRANSLATIONS && window.TRANSLATIONS[getLang()]) || {};
        return (key && d[key]) || '';
      }
      function dict(){ return (window.TRANSLATIONS && window.TRANSLATIONS[getLang()]) || {}; }

      function refresh(){
        if (checkin) checkin.value = checkinDate ? toISO(checkinDate) : '';
        if (checkout) checkout.value = checkoutDate ? toISO(checkoutDate) : '';
        if (fakeIn){
          fakeIn.textContent = checkinDate ? fmt(checkinDate) : emptyLabel(fakeIn);
          fakeIn.classList.toggle('filled', !!checkinDate);
        }
        if (fakeOut){
          fakeOut.textContent = checkoutDate ? fmt(checkoutDate) : emptyLabel(fakeOut);
          fakeOut.classList.toggle('filled', !!checkoutDate);
        }
        var destOk = !dest || (dest.value && dest.value !== '');
        var datesOk = (!checkin || !!checkinDate) && (!checkout || !!checkoutDate);
        if (submit) submit.disabled = !(destOk && datesOk);
      }
      qbRefreshers.push(refresh);

      if (dest) dest.addEventListener('change', refresh);

      if (checkinField){
        checkinField.querySelector('.qb-datebtn').addEventListener('click', function(e){
          e.stopPropagation();
          openCalendar(checkinField, {
            value: checkinDate, min: startOfDay(new Date()), dict: dict(),
            onSelect: function(d){
              checkinDate = d;
              if (checkoutDate && checkoutDate <= checkinDate){
                var next = new Date(checkinDate); next.setDate(next.getDate() + 1);
                checkoutDate = next;
              }
              refresh();
              closeCalendar();
              if (checkoutField && !checkoutDate){
                setTimeout(function(){
                  checkoutField.querySelector('.qb-datebtn').click();
                }, 160);
              }
            },
            onClear: function(){ checkinDate = null; refresh(); closeCalendar(); }
          });
        });
      }

      if (checkoutField){
        checkoutField.querySelector('.qb-datebtn').addEventListener('click', function(e){
          e.stopPropagation();
          var min = checkinDate ? (function(){ var n = new Date(checkinDate); n.setDate(n.getDate()+1); return n; })() : startOfDay(new Date());
          openCalendar(checkoutField, {
            value: checkoutDate, min: min, dict: dict(),
            onSelect: function(d){ checkoutDate = d; refresh(); closeCalendar(); },
            onClear: function(){ checkoutDate = null; refresh(); closeCalendar(); }
          });
        });
      }

      refresh();

      form.addEventListener('submit', function(e){
        e.preventDefault();
        if (submit && submit.disabled) return;
        var url = dest ? dest.options[dest.selectedIndex].getAttribute('data-url') : form.getAttribute('data-book-url');
        if (!url) return;
        var params = new URLSearchParams();
        if (checkin && checkin.value) params.set('checkin', checkin.value);
        if (checkout && checkout.value) params.set('checkout', checkout.value);
        var sep = url.indexOf('?') > -1 ? '&' : '?';
        window.open(url + (params.toString() ? sep + params.toString() : ''), '_blank');
      });
    });

    // sticky header shadow on scroll
    var header = document.querySelector('.site-header');
    if (header){
      window.addEventListener('scroll', function(){
        header.style.boxShadow = window.scrollY > 10 ? '0 6px 24px rgba(18,35,46,0.08)' : 'none';
      });
    }

    // ---- gentle reveal-on-scroll for section heads, property rows & service cards ----
    var revealTargets = document.querySelectorAll(
      '.section-head, .property-row, .services-grid, .amenity-strip, .room-item, .booking-cta, .contact-grid > div, .mini-contact-card, .gallery-grid'
    );
    revealTargets.forEach(function(el){ el.classList.add('reveal'); });
    document.querySelectorAll('.services-grid').forEach(function(el){ el.classList.add('reveal-stagger'); });

    if ('IntersectionObserver' in window && revealTargets.length){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting){
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealTargets.forEach(function(el){ io.observe(el); });
    } else {
      revealTargets.forEach(function(el){ el.classList.add('in-view'); });
    }

    // ---- custom cursor (pointer devices only, disabled on touch) ----
    var isFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (isFinePointer){
      document.body.classList.add('has-custom-cursor');
      var dot = document.createElement('div');
      var ring = document.createElement('div');
      dot.className = 'cursor-dot';
      ring.className = 'cursor-ring';
      document.body.appendChild(dot);
      document.body.appendChild(ring);
      var ringX = 0, ringY = 0, mouseX = 0, mouseY = 0;
      window.addEventListener('mousemove', function(e){
        mouseX = e.clientX; mouseY = e.clientY;
        dot.style.transform = 'translate(' + mouseX + 'px,' + mouseY + 'px)';
      });
      (function loop(){
        ringX += (mouseX - ringX) * 0.18;
        ringY += (mouseY - ringY) * 0.18;
        ring.style.transform = 'translate(' + ringX + 'px,' + ringY + 'px)';
        requestAnimationFrame(loop);
      })();
      document.addEventListener('mouseover', function(e){
        var interactive = e.target.closest('a, button, select, input, .qb-item, [role="button"]');
        document.body.classList.toggle('cursor-hover', !!interactive);
      });
      document.addEventListener('mousedown', function(){ document.body.classList.add('cursor-down'); });
      document.addEventListener('mouseup', function(){ document.body.classList.remove('cursor-down'); });
      document.addEventListener('mouseleave', function(){ document.body.classList.add('cursor-hidden'); });
      document.addEventListener('mouseenter', function(){ document.body.classList.remove('cursor-hidden'); });
    }
  });
})();
