// Human-in-the-Loop Interaction & Draft Logic Script
document.addEventListener('DOMContentLoaded', () => {
    let selectedTone = 'Friendly';
    let isGenerating = false;

    // Toggle Dev Controls
    const toggleInspector = document.getElementById('toggle-state-inspector');
    const toggleLogs = document.getElementById('toggle-logs');
    const devColumn = document.getElementById('dev-panels-column');
    const inspectorCard = document.getElementById('state-inspector-card');
    const logsCard = document.getElementById('logs-card');
    const layoutGrid = document.getElementById('main-layout-grid');
    const appContainer = document.querySelector('.app-container');

    function updateDevVisibility() {
        const showInspector = toggleInspector.checked;
        const showLogs = toggleLogs.checked;

        if (showInspector || showLogs) {
            devColumn.classList.remove('hidden');
            layoutGrid.classList.add('dev-active');
            appContainer.classList.add('dev-active');
        } else {
            devColumn.classList.add('hidden');
            layoutGrid.classList.remove('dev-active');
            appContainer.classList.remove('dev-active');
        }

        if (showInspector) {
            inspectorCard.classList.remove('hidden');
        } else {
            inspectorCard.classList.add('hidden');
        }

        if (showLogs) {
            logsCard.classList.remove('hidden');
        } else {
            logsCard.classList.add('hidden');
        }
    }

    toggleInspector.addEventListener('change', updateDevVisibility);
    toggleLogs.addEventListener('change', updateDevVisibility);

    // Tone Pills Selection
    const tonePills = document.querySelectorAll('.tone-pill');
    tonePills.forEach(pill => {
        pill.addEventListener('click', () => {
            tonePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedTone = pill.getAttribute('data-tone');
            addLog('System', `Tone set to: ${selectedTone}`, 'sys');
        });
    });

    // Draft Generation Trigger
    const customerMsgInput = document.getElementById('customer-message');
    const draftBtn = document.getElementById('draft-reply-btn');
    const outputBox = document.getElementById('reply-output-box');
    const replyText = document.getElementById('draft-reply-text');
    const toneBadge = document.getElementById('active-tone-badge');

    draftBtn.addEventListener('click', () => generateReply());

    document.getElementById('regenerate-btn').addEventListener('click', () => generateReply());

    function generateReply() {
        if (isGenerating) return;
        const customerText = customerMsgInput.value.trim() || "Hi, I ordered a package 3 days ago but haven't received a tracking update yet. Could you help?";

        isGenerating = true;
        draftBtn.disabled = true;
        draftBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Drafting reply...`;

        addLog('AgenticLLM', `Drafting reply in [${selectedTone}] tone for customer query...`, 'proc');

        setTimeout(() => {
            const generatedDrafts = {
                'Friendly': `Hi there! Thanks for reaching out. I'd be happy to check on your tracking update right away. Let me pull up your order details!`,
                'Formal': `Dear Customer, Thank you for contacting support. We acknowledge your query regarding the tracking status and are investigating immediately.`,
                'Apologetic': `Hello, we sincerely apologize for the delay in providing tracking information for your order. We are expediting this issue right now.`,
                'Concise': `Order tracking update being generated. We will send tracking details shortly.`
            };

            const resultDraft = generatedDrafts[selectedTone] || generatedDrafts['Friendly'];

            toneBadge.textContent = `${selectedTone} Tone`;
            replyText.textContent = resultDraft;
            outputBox.classList.remove('hidden');

            updateJSONState(customerText, selectedTone, resultDraft);
            addLog('AgenticLLM', `Draft generated successfully. Pending human approval.`, 'succ');

            isGenerating = false;
            draftBtn.disabled = false;
            draftBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Draft reply`;
        }, 1100);
    }

    document.getElementById('approve-btn').addEventListener('click', () => {
        addLog('HumanOperator', `Approved & sent reply to customer.`, 'succ');
        alert("Reply approved and sent to customer!");
    });

    function updateJSONState(msg, tone, draft) {
        const jsonViewer = document.getElementById('state-json-viewer');
        const stateObj = {
            customer_message: msg,
            selected_tone: tone,
            ai_draft_generated: draft,
            human_in_the_loop_status: "AWAITING_APPROVAL",
            timestamp: new Date().toISOString()
        };
        jsonViewer.textContent = JSON.stringify(stateObj, null, 2);
    }

    function addLog(sender, text, type = 'sys') {
        const consoleEl = document.getElementById('logs-container');
        const time = new Date().toTimeString().split(' ')[0];
        const line = document.createElement('div');
        line.className = `log-entry ${type}`;
        line.innerHTML = `<span class="ts">[${time}]</span> <strong>${sender}:</strong> ${text}`;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    document.getElementById('clear-logs-btn').addEventListener('click', () => {
        document.getElementById('logs-container').innerHTML = '';
        addLog('System', 'Logs console cleared.', 'sys');
    });

    // Ambient Particle Network Animation
    initCanvas();
    function initCanvas() {
        const canvas = document.getElementById('bg-network-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        });

        const particles = Array.from({ length: 28 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6
        }));

        function draw() {
            ctx.clearRect(0, 0, w, h);
            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
                ctx.fill();

                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                    if (dist < 110) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(56, 189, 248, ${0.12 - dist / 110 * 0.12})`;
                        ctx.stroke();
                    }
                }
            });
            requestAnimationFrame(draw);
        }
        draw();
    }
});
