// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Module for displaying Panopto content asynchronously.
 *
 * @module block_panopto/asyncload
 * @copyright Panopto 2025
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {call as fetchMany} from "core/ajax";
import {get_string} from "core/str";
import * as log from "core/log";
import {renderForPromise, replaceNodeContents} from "core/templates";

/**
 * Post the block's SSO form to a Panopto page, so the user arrives there signed in.
 *
 * @param {HTMLElement} node The block's content container.
 * @param {string} url The Panopto page to open.
 * @param {string} target The name of the window or tab to open it in.
 */
const submitSso = (node, url, target) => {
    const form = node.querySelector('form[data-region="panopto-sso-form"]');
    if (!form) {
        return;
    }

    form.action = url;
    form.target = target;
    form.submit();
};

/**
 * Register click handlers for the block's content, which may be replaced after loading.
 *
 * @param {HTMLElement} node The block's content container.
 */
const registerEventListeners = (node) => {
    node.addEventListener('click', (event) => {
        const link = event.target.closest('[data-action]');
        if (!link || !node.contains(link)) {
            return;
        }

        if (link.dataset.action === 'panopto-sso') {
            event.preventDefault();
            submitSso(node, link.href, '_blank');
            return;
        }

        if (link.dataset.action === 'panopto-notes') {
            event.preventDefault();
            const notesWindow = window.open('', 'PanoptoNotes',
                'width=500,height=800,resizable=1,scrollbars=0,status=0,location=0');
            submitSso(node, link.dataset.notesUrl, 'PanoptoNotes');
            if (notesWindow) {
                notesWindow.focus();
            }
            return;
        }

        if (link.dataset.action === 'panopto-toggle-recordings') {
            event.preventDefault();
            const expand = link.getAttribute('aria-expanded') !== 'true';
            const recordings = node.querySelector('[data-region="panopto-more-recordings"]');
            if (recordings) {
                recordings.style.display = expand ? 'block' : 'none';
            }
            link.setAttribute('aria-expanded', expand ? 'true' : 'false');
            link.querySelector('[data-region="panopto-show-all"]')?.toggleAttribute('hidden', expand);
            link.querySelector('[data-region="panopto-show-less"]')?.toggleAttribute('hidden', !expand);
        }
    });
};

/**
 * Replace the block's content with a fixed message after a failure.
 *
 * @param {HTMLElement} node The block's content container.
 * @param {Error} error The failure, an exception object rather than markup.
 */
const showLoadError = (node, error) => {
    log.error(error);
    get_string('load_content_error', 'block_panopto').then((message) => {
        node.textContent = message;
        return message;
    }).catch(log.error);
};

/**
 * Load the Panopto block's content for a course into its container.
 *
 * @param {Object} params
 * @param {string} params.id The id of the element that holds the block's content.
 * @param {number} params.courseid The course whose Panopto content is loaded.
 */
export const initblock = (params) => {
    const node = document.getElementById(params.id);
    if (!node) {
        log.debug(`Couldn't find element with id: ${params.id}`);
        return;
    }

    registerEventListeners(node);
    const request = {
        methodname: 'block_panopto_get_content',
        args: {
            courseid: params.courseid,
        },
    };

    fetchMany([request])[0].then((response) => {
        return renderForPromise('block_panopto/block_content', response);
    }).then((rendered) => {
        replaceNodeContents(node, rendered.html, rendered.js);
        return rendered;
    }).catch((error) => {
        showLoadError(node, error);
    });
};
