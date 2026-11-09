extends CbScreen
## The ticket drawer (M0 placeholder): the open ticket's card (title, brief, customer), the ticket and level lists. The real
## ticket board, spec card and instruments arrive in M2.

func build(b: VBoxContainer) -> void:
	var card = app.b.q("ticketCard")
	CbKit.header(b, tr("TICKET_TITLE"), tr("TICKET_SUB"))
	if card == null:
		var p := CbKit.panel(tr("TICKET_NONE"), true, b); var v: VBoxContainer = p[1]
		v.add_child(CbKit.label(tr("TICKET_NONE_BODY"), 16, CbKit.TX, true))
		var bt := CbKit.btn(tr("TICKET_OPEN"), func(): app.b.act("openTicket", ["0-0"]), "pri", 16)
		v.add_child(bt)
		return
	var p2 := CbKit.panel(str(card.title), true, b); var v2: VBoxContainer = p2[1]
	v2.add_child(CbKit.label(str(card.brief), 17, CbKit.TX, true))
	v2.add_child(CbKit.label("%s · %s" % [str(card.customer), str(card.stall)], 14, CbKit.DIM))
	v2.add_child(CbKit.btn(tr("TICKET_CLOSE"), func(): app.b.act("closeTicket", []), "", 15))
