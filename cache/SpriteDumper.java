package net.runelite.cache;

import com.google.common.io.Files;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import net.runelite.cache.definitions.SpriteDefinition;
import net.runelite.cache.definitions.exporters.SpriteExporter;
import net.runelite.cache.fs.Store;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;

public class SpriteDumper
{
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	static class SpriteExport
	{
		int spriteId;
		int frame;
		int width;
		int height;
		String file;
	}

	public static void main(String[] args) throws IOException
	{
		Options options = new Options();
		options.addOption(Option.builder().longOpt("cachedir").hasArg().required().build());
		options.addOption(Option.builder().longOpt("outputdir").hasArg().required().build());

		CommandLineParser parser = new DefaultParser();
		CommandLine cmd;
		try
		{
			cmd = parser.parse(options, args);
		}
		catch (ParseException ex)
		{
			System.err.println("Error parsing command line options: " + ex.getMessage());
			System.exit(-1);
			return;
		}

		File base = new File(cmd.getOptionValue("cachedir"));
		File outDir = new File(cmd.getOptionValue("outputdir"));
		outDir.mkdirs();

		try (Store store = new Store(base))
		{
			store.load();

			SpriteManager spriteManager = new SpriteManager(store);
			spriteManager.load();

			List<SpriteExport> exports = new ArrayList<>();
			for (SpriteDefinition sprite : spriteManager.getSprites())
			{
				if (sprite.getHeight() <= 0 || sprite.getWidth() <= 0)
				{
					continue;
				}

				File png = new File(outDir, sprite.getId() + "-" + sprite.getFrame() + ".png");
				new SpriteExporter(sprite).exportTo(png);

				SpriteExport export = new SpriteExport();
				export.spriteId = sprite.getId();
				export.frame = sprite.getFrame();
				export.width = sprite.getWidth();
				export.height = sprite.getHeight();
				export.file = png.getName();
				exports.add(export);
			}

			exports.sort(Comparator.comparingInt((SpriteExport export) -> export.spriteId)
				.thenComparingInt(export -> export.frame));
			Files.asCharSink(new File(outDir, "sprite_manifest.json"), Charset.defaultCharset()).write(GSON.toJson(exports));
		}
	}
}