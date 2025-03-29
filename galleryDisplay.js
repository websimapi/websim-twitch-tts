import * as config from 'config';

const galleryBox = document.getElementById('image-gallery-box');
const clearGalleryBtn = document.getElementById('clear-gallery-btn');
const emptyGalleryMessage = galleryBox ? galleryBox.querySelector('.empty-gallery') : null;

function createImageElement(imageData) {
    const { user, prompt, url, timestamp } = imageData;
    const item = document.createElement('div');
    item.className = 'gallery-item';

    const imgLink = document.createElement('a');
    imgLink.href = url;
    imgLink.target = '_blank'; 

    const img = document.createElement('img');
    img.src = url;
    img.alt = prompt;
    img.title = `"${prompt}" by ${user} (${new Date(timestamp).toLocaleString()})`;
    img.loading = 'lazy'; 

    imgLink.appendChild(img);
    item.appendChild(imgLink);

    const info = document.createElement('div');
    info.className = 'gallery-info';
    info.innerHTML = `
        <span class="gallery-prompt">"${prompt}"</span>
        <span class="gallery-user">by ${user}</span>
        <span class="gallery-time">${new Date(timestamp).toLocaleTimeString()}</span>
    `;
    item.appendChild(info);

    return item;
}

function loadGallery() {
    if (!galleryBox) return;
    galleryBox.innerHTML = ''; 
    const galleryData = config.getSetting('imageGallery');

    if (!galleryData || galleryData.length === 0) {
         if (emptyGalleryMessage) {
              galleryBox.appendChild(emptyGalleryMessage);
              emptyGalleryMessage.style.display = 'block';
         } else {
              galleryBox.innerHTML = '<div class="empty-gallery">Gallery is empty. Use !image &lt;prompt&gt; to generate images.</div>';
         } 
         return;
    }

    if (emptyGalleryMessage) emptyGalleryMessage.style.display = 'none';

    galleryData.slice().reverse().forEach(imageData => {
        galleryBox.appendChild(createImageElement(imageData));
    });
}

function addImageToDisplay(imageData) {
    if (!galleryBox) return;
     if (emptyGalleryMessage) emptyGalleryMessage.style.display = 'none';

    const newImageElement = createImageElement(imageData);
    galleryBox.insertBefore(newImageElement, galleryBox.firstChild);

    const maxGallerySize = config.getSetting('imageGenMaxGallery');
    while (galleryBox.children.length > maxGallerySize) {
        if (galleryBox.lastChild && galleryBox.lastChild !== emptyGalleryMessage) {
             galleryBox.removeChild(galleryBox.lastChild);
        } else {
             break; 
        }
    }
}

function clearGallery() {
    if (confirm("Are you sure you want to clear the entire image gallery?")) {
        config.setSetting('imageGallery', []); 
        loadGallery(); 
    }
}

if (clearGalleryBtn) {
    clearGalleryBtn.addEventListener('click', clearGallery);
}

document.addEventListener('DOMContentLoaded', loadGallery);


export { loadGallery, addImageToDisplay, clearGallery };
