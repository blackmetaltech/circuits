extends SceneTree
## QA: draw the meter's LCD panel alone into a SubViewport and save it (CB_OUT), to check the glyphs without the 3D scene.
func _init() -> void:
	var vp := SubViewport.new(); vp.size = Vector2i(480, 220); vp.disable_3d = true; vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var lcd := Instruments3D.SegPanel.new()
	lcd.digit_area = Rect2(52, 28, 292, 150); lcd.ndig = 4; lcd.ghost_col = Color(0.05, 0.07, 0.05, 0.07)
	lcd.size = Vector2(480, 220); lcd.text = OS.get_environment("CB_TXT")
	if OS.get_environment("CB_FIX") != "": lcd.bg_col2 = lcd.bg_col; lcd.shear = float(OS.get_environment("CB_SHEAR")); lcd.digit_area = Rect2(48, 44, 300, 124)
	vp.add_child(lcd); root.add_child(vp)
	for i in 10: await process_frame
	vp.get_texture().get_image().save_png(OS.get_environment("CB_OUT"))
	quit()
